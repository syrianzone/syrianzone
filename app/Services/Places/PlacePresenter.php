<?php

namespace App\Services\Places;

use App\Models\Place;
use App\Models\PlacePhoto;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * The single shape places are presented in.
 *
 * The web dashboard, the agent tools and the public mishwar endpoints all read
 * the same rows. The admin and agent surfaces share one shape, and the public
 * surfaces have their own — narrower — shapes, also built here, so a field can
 * be renamed once instead of in every controller that served it.
 */
class PlacePresenter
{
    /**
     * Base query for the moderation queue, with the relations the serializer
     * needs already eager-loaded.
     */
    public function query(?int $viewerId = null): Builder
    {
        return Place::with(['user', 'photos'])
            ->withExists(['saves as saved_by_me' => fn ($q) => $q->where('user_id', $viewerId)])
            ->latest();
    }

    /**
     * @return LengthAwarePaginator<int, Place>
     */
    public function paginate(?string $status, int $perPage = 20, ?int $viewerId = null): LengthAwarePaginator
    {
        $query = $this->query($viewerId);

        if ($status !== null && $status !== 'all') {
            $query->where('status', $status);
        }

        return $query->paginate($perPage);
    }

    /**
     * Re-hydrate a single place for presentation.
     */
    public function present(Place $place, ?int $viewerId = null): Place
    {
        return $this->query($viewerId)->findOrFail($place->id);
    }

    /**
     * The moderation row: everything a reviewer or an agent needs.
     *
     * @return array<string, mixed>
     */
    public function item(Place $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'category' => $p->category,
            'description' => $p->description,
            'lat' => $p->lat,
            'lng' => $p->lng,
            'thumb_url' => $p->photos->first()?->thumb_url,
            'saves_count' => $p->saves_count,
            'status' => $p->status,
            'user' => [
                'id' => $p->user->id,
                'name' => $p->user->name,
                'avatar_url' => $p->user->avatar_url,
            ],
            'photos' => $p->photos->map(fn ($photo) => $this->photo($photo))->values(),
            'saved_by_me' => (bool) $p->saved_by_me,
            'created_at' => $p->created_at,
            'rejection_reason' => $p->rejection_reason,
        ];
    }

    /**
     * The public list row: the map, the cards and the nearby drawer.
     *
     * @return array<string, mixed>
     */
    public function publicListItem(Place $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'category' => $p->category,
            'description' => $p->description,
            'lat' => $p->lat,
            'lng' => $p->lng,
            'thumb_url' => $p->photos->first()?->thumb_url,
            'saves_count' => $p->saves_count,
        ];
    }

    /**
     * The public detail: the list row plus moderation state, the contributor's
     * standing and every photo.
     *
     * @param  array{points: int, level: int}  $guide
     * @return array<string, mixed>
     */
    public function publicDetail(Place $p, array $guide, bool $savedByMe): array
    {
        return $this->publicListItem($p) + [
            'status' => $p->status,
            'user' => [
                'id' => $p->user->id,
                'name' => $p->user->name,
                'avatar_url' => $p->user->avatar_url,
                'level' => $guide['level'],
                'points' => $guide['points'],
            ],
            'photos' => $p->photos->map(fn ($photo) => $this->photo($photo))->values(),
            'saved_by_me' => $savedByMe,
            'created_at' => $p->created_at,
        ];
    }

    /**
     * The owner's own list (/my/places): the list row plus what moderation said.
     *
     * @return array<string, mixed>
     */
    public function ownerListItem(Place $p): array
    {
        return $this->publicListItem($p) + [
            'status' => $p->status,
            'rejection_reason' => $p->rejection_reason,
            'created_at' => $p->created_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function photo(PlacePhoto $photo): array
    {
        return [
            'id' => $photo->id,
            'thumb_url' => $photo->thumb_url,
            'display_url' => $photo->display_url,
            'sort' => $photo->sort,
        ];
    }

    /**
     * The refreshed urls a photo mutation answers with, without the ordering.
     *
     * @return array<string, mixed>
     */
    public function photoUrls(PlacePhoto $photo): array
    {
        return [
            'id' => $photo->id,
            'thumb_url' => $photo->thumb_url,
            'display_url' => $photo->display_url,
        ];
    }

    /**
     * A photo on the public wall, with the place columns the grid joins in
     * (see PlaceDiscoveryController::photos()). They arrive as aliases, not as
     * a loaded relation. lat/lng ride along so the grid can fly to the place
     * without a second fetch.
     *
     * @return array<string, mixed>
     */
    public function photoWallItem(PlacePhoto $photo): array
    {
        return [
            'id' => $photo->id,
            'thumb_url' => $photo->thumb_url,
            'display_url' => $photo->display_url,
            'place' => [
                'id' => (int) $photo->place_id,
                'name' => $photo->place_name,
                'category' => $photo->place_category,
                'lat' => (float) $photo->place_lat,
                'lng' => (float) $photo->place_lng,
            ],
        ];
    }
}
