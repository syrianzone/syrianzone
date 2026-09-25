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
 * Every method here used to live inline in PlaceAdminController, which made it
 * unreachable from anywhere except an HTTP request carrying a session cookie.
 * Extracting it means the web dashboard and the agent MCP surface run the exact
 * same validation, state guards, locking and cache invalidation, instead of two
 * copies drifting apart.
 *
 * Rules that must not be relaxed:
 *  - Only `pending` places may be approved or rejected.
 *  - At most MAX_PHOTOS_PER_PLACE photos, at least one.
 *  - Both photo-count guards run under a row lock on the place, so concurrent
 *    writers cannot both read 9 and end at 11 (or both pass min-1 and leave 0).
 *  - Any change that can alter the map payload forgets the `places:map` cache.
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

        $this->bustMapCache();

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
     * @param  array<string, mixed>  $attributes
     */
    public function update(int $id, array $attributes): Place
    {
        $place = $this->findOrFail($id);

        $place->update($attributes);

        // name/category/coords are embedded in the map payload
        $this->bustMapCache();

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

        $this->bustMapCache();
    }

    /**
     * Append a photo at the end of the place's ordering.
     */
    public function addPhoto(int $placeId, UploadedFile $file): PlacePhoto
    {
        $place = $this->findOrFail($placeId);

        // guard + store under a lock on the place row so two concurrent adds
        // cannot both read count 9 and end at 11
        $photo = DB::transaction(function () use ($place, $file) {
            Place::whereKey($place->id)->lockForUpdate()->first();

            if ($place->photos()->count() >= self::MAX_PHOTOS_PER_PLACE) {
                return null;
            }

            return $this->images->store($file, $place->id, (int) $place->photos()->max('sort') + 1);
        });

        if ($photo === null) {
            throw PlaceActionException::photoLimit(self::MAX_PHOTOS_PER_PLACE);
        }

        // a first-position thumb can change the map thumb_url; forget unconditionally
        $this->bustMapCache();

        return $photo;
    }

    public function replacePhoto(int $photoId, UploadedFile $file): PlacePhoto
    {
        $photo = PlacePhoto::findOrFail($photoId);

        $this->images->replace($photo, $file);

        $this->bustMapCache();

        return $photo;
    }

    public function rotatePhoto(int $photoId): PlacePhoto
    {
        $photo = PlacePhoto::findOrFail($photoId);

        try {
            $this->images->rotateClockwise($photo);
        } catch (\RuntimeException) {
            // the file is gone from disk (cdn may still show a ghost copy):
            // only a re-upload helps
            throw PlaceActionException::photoFileMissing();
        }

        // the map cache embeds versioned thumb urls
        $this->bustMapCache();

        return $photo;
    }

    public function deletePhoto(int $photoId): void
    {
        $photo = PlacePhoto::findOrFail($photoId);

        // same lock as addPhoto: two concurrent deletes on a 2-photo place must
        // not both pass the min-1 guard and leave the place with zero photos
        $deleted = DB::transaction(function () use ($photo) {
            Place::whereKey($photo->place_id)->lockForUpdate()->first();

            if (PlacePhoto::where('place_id', $photo->place_id)->count() <= 1) {
                return false;
            }

            $photo->delete();

            return true;
        });

        if (! $deleted) {
            throw PlaceActionException::lastPhoto();
        }

        // files go after the row commit so a rollback cannot orphan the photo row
        $this->images->deleteFiles($photo);

        $this->bustMapCache();
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

    private function bustMapCache(): void
    {
        Cache::forget(self::MAP_CACHE_KEY);
    }
}
