<?php

namespace App\Services\Places;

use App\Exceptions\Places\PlaceActionException;
use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\PlaceImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * The places moderation domain, transport-free.
 *
 * The web dashboard and the agent MCP surface run the exact same validation,
 * state guards, locking and cache invalidation, instead of two copies drifting
 * apart.
 *
 * Rules that must not be relaxed:
 *  - Only `pending` places may be approved or rejected.
 *  - At most MAX_PHOTOS_PER_PLACE photos, at least one.
 *  - Both photo-count guards run under a row lock on the place, so concurrent
 *    writers cannot both read 9 and end at 11 (or both pass min-1 and leave 0).
 *  - Any change that can alter the map payload forgets the `places:map` cache.
 *
 * The owner endpoints and the moderation endpoints share the photo workflow but
 * not its after-effect: an owner's photo change sends the place back to review
 * (`reentersModeration: true`), while a moderator's does not. That difference is
 * a parameter of the one implementation, not a second copy of it.
 */
class PlaceModerationService
{
    public const MAX_PHOTOS_PER_PLACE = 10;

    public const MAP_CACHE_KEY = 'places:map';

    public function __construct(private readonly PlaceImageService $images) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function approve(int $id, array $attributes = []): Place
    {
        $place = $this->findOrFail($id);

        $this->assertPending($place);

        $place->update($attributes + ['status' => 'approved', 'approved_at' => now()]);

        self::forgetMapCache();

        return $place;
    }

    public function reject(int $id, ?string $reason = null): Place
    {
        $place = $this->findOrFail($id);

        $this->assertPending($place);

        $place->update(['status' => 'rejected', 'rejection_reason' => $reason]);

        return $place;
    }

    /**
     * Take a published place off the public map and send it back to the review
     * queue (used when a report is upheld). It can then be rejected, edited or
     * re-approved through the normal pending flow.
     */
    public function unpublish(int $id): Place
    {
        $place = $this->findOrFail($id);

        if ($place->status !== 'approved') {
            throw PlaceActionException::notApproved($place->status);
        }

        $place->update(['status' => 'pending', 'approved_at' => null]);

        self::forgetMapCache();

        return $place;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(int $id, array $attributes): Place
    {
        $place = $this->findOrFail($id);

        $place->update($attributes);

        // name/category/coords are embedded in the map payload
        self::forgetMapCache();

        return $place;
    }

    public function delete(int $id): void
    {
        $place = Place::with('photos')->find($id);

        if ($place === null) {
            throw PlaceActionException::notFound($id);
        }

        $photos = $place->photos->all();
        $place->delete();

        foreach ($photos as $photo) {
            $this->images->deleteFiles($photo);
        }

        self::forgetMapCache();
    }

    /**
     * Append a photo at the end of the place's ordering.
     *
     * `$reentersModeration` is what the owner surface has always done: a new
     * photo puts the place back in the review queue with any prior verdict
     * cleared. The dashboard and the agent tools do not, because a moderator
     * adding material is not a new submission.
     */
    public function addPhoto(int $placeId, UploadedFile $file, bool $reentersModeration = false): PlacePhoto
    {
        $place = $this->findOrFail($placeId);

        // guard + store under a lock on the place row so two concurrent adds
        // cannot both read count 9 and end at 11
        $photo = DB::transaction(function () use ($place, $file, $reentersModeration) {
            Place::whereKey($place->id)->lockForUpdate()->first();

            if ($place->photos()->count() >= self::MAX_PHOTOS_PER_PLACE) {
                return null;
            }

            $photo = $this->images->store($file, $place->id, (int) $place->photos()->max('sort') + 1);

            if ($reentersModeration) {
                $this->markPending($place);
            }

            return $photo;
        });

        if ($photo === null) {
            throw PlaceActionException::photoLimit(self::MAX_PHOTOS_PER_PLACE);
        }

        // a first-position thumb can change the map thumb_url; forget unconditionally
        self::forgetMapCache();

        return $photo;
    }

    public function replacePhoto(int $photoId, UploadedFile $file): PlacePhoto
    {
        $photo = PlacePhoto::findOrFail($photoId);

        $this->images->replace($photo, $file);

        self::forgetMapCache();

        return $photo;
    }

    /**
     * Rotate the photo's pixels. Approval status is deliberately kept.
     *
     * `$withRecoveryHint` carries the one wording difference between the two
     * surfaces that can hit a missing file: the dashboard/agent refusal says
     * what to do next, the owner endpoint has never included that sentence.
     */
    public function rotatePhoto(int $photoId, bool $withRecoveryHint = true): PlacePhoto
    {
        $photo = PlacePhoto::findOrFail($photoId);

        try {
            $this->images->rotateClockwise($photo);
        } catch (\RuntimeException) {
            // the file is gone from disk (cdn may still show a ghost copy):
            // only a re-upload helps
            throw PlaceActionException::photoFileMissing($withRecoveryHint);
        }

        // the map cache embeds versioned thumb urls
        self::forgetMapCache();

        return $photo;
    }

    /**
     * @param  bool  $reentersModeration  See addPhoto(): the owner surface sends
     *                                    the place back to review, moderation does not.
     */
    public function deletePhoto(int $photoId, bool $reentersModeration = false): void
    {
        $photo = PlacePhoto::findOrFail($photoId);

        // same lock as addPhoto: two concurrent deletes on a 2-photo place must
        // not both pass the min-1 guard and leave the place with zero photos
        $deleted = DB::transaction(function () use ($photo, $reentersModeration) {
            $place = Place::whereKey($photo->place_id)->lockForUpdate()->first();

            if (PlacePhoto::where('place_id', $photo->place_id)->count() <= 1) {
                return false;
            }

            $photo->delete();

            if ($reentersModeration) {
                $this->markPending($place);
            }

            return true;
        });

        if (! $deleted) {
            throw PlaceActionException::lastPhoto();
        }

        // files go after the row commit so a rollback cannot orphan the photo row
        $this->images->deleteFiles($photo);

        self::forgetMapCache();
    }

    public function findOrFail(int $id): Place
    {
        $place = Place::find($id);

        if ($place === null) {
            throw PlaceActionException::notFound($id);
        }

        return $place;
    }

    private function assertPending(Place $place): void
    {
        if ($place->status !== 'pending') {
            throw PlaceActionException::notPending($place->status);
        }
    }

    /**
     * Edited content re-enters moderation: any prior rejection reason and
     * approval are cleared, and the (possibly approved) pin leaves the public map.
     *
     * The cache forget stays outside the caller's transaction (see the note on
     * PlaceReportController::resolve); a concurrent map read must not re-cache a
     * status change that has not committed yet.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function returnToModeration(Place $place, array $attributes = []): void
    {
        $this->markPending($place, $attributes);

        self::forgetMapCache();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function markPending(Place $place, array $attributes = []): void
    {
        $place->update($attributes + ['status' => 'pending', 'rejection_reason' => null, 'approved_at' => null]);
    }

    /**
     * The one way to drop the cached map payload. Anything that changes a pin,
     * its photos or its moderation state calls this.
     */
    public static function forgetMapCache(): void
    {
        Cache::forget(self::MAP_CACHE_KEY);
    }
}
