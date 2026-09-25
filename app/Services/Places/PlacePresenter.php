<?php

namespace App\Services\Places;

use App\Models\Place;
use App\Models\PlacePhoto;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * The single shape places are presented in, for both the admin UI and agents.
 *
 * The web dashboard and the MCP tools must agree on field names and on what is
 * omitted — a moderation queue that shows one thing to a human and another to an
 * agent is how a bad approve slips through.
 */
class PlacePresenter
{
    public const STATUSES = ['pending', 'approved', 'rejected'];

    public const CATEGORIES = [
        'historical', 'natural', 'cultural', 'religious',
        'abandoned', 'viewpoint', 'market', 'food', 'other',
    ];

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
            'photos' => $p->photos->map(fn ($photo) => [
                'id' => $photo->id,
                'thumb_url' => $photo->thumb_url,
                'display_url' => $photo->display_url,
                'sort' => $photo->sort,
            ])->values(),
            'saved_by_me' => (bool) $p->saved_by_me,
            'created_at' => $p->created_at,
            'rejection_reason' => $p->rejection_reason,
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
}
