<?php

namespace App\Services;

use App\Models\Place;
use App\Models\PlaceComment;
use App\Models\PlaceReport;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

class PlacePresenter
{
    public function listItem(Place $place): array
    {
        $photo = $place->photos->first();

        return [
            'id' => $place->id,
            'name' => $place->name,
            'category' => $place->category,
            'description' => $place->description,
            'lat' => $place->lat,
            'lng' => $place->lng,
            'thumb_url' => $photo ? Storage::disk('public')->url($photo->thumb_path) : null,
            'likes_count' => $place->likes_count,
            'saves_count' => $place->saves_count,
            'comments_count' => $place->comments_count,
        ];
    }

    public function detail(Place $place, ?int $viewerId): array
    {
        return $this->listItem($place) + [
            'status' => $place->status,
            'user' => $this->user($place->user, $place->user_id, true),
            'photos' => $place->photos->map(fn ($photo) => [
                'id' => $photo->id,
                'thumb_url' => Storage::disk('public')->url($photo->thumb_path),
                'display_url' => Storage::disk('public')->url($photo->display_path),
                'sort' => $photo->sort,
            ])->values()->all(),
            'liked_by_me' => $this->engagedBy($place, 'liked_by_me', 'likes', $viewerId),
            'saved_by_me' => $this->engagedBy($place, 'saved_by_me', 'saves', $viewerId),
            'created_at' => $place->created_at->toISOString(),
        ];
    }

    public function adminItem(Place $place, int $viewerId): array
    {
        return $this->detail($place, $viewerId) + [
            'rejection_reason' => $place->rejection_reason,
            'reports_count' => (int) $place->reports_count,
        ];
    }

    public function comment(PlaceComment $comment): array
    {
        return [
            'id' => $comment->id,
            'body' => $comment->body,
            'created_at' => $comment->created_at->toISOString(),
            'user' => $this->user($comment->user, $comment->user_id, true),
        ];
    }

    public function report(PlaceReport $report): array
    {
        return [
            'id' => $report->id,
            'reason' => $report->reason,
            'details' => $report->details,
            'status' => $report->status,
            'created_at' => $report->created_at->toISOString(),
            'user' => $this->user($report->user, $report->user_id, false),
            'place' => [
                'id' => $report->place->id,
                'name' => $report->place->name,
                'status' => $report->place->status,
            ],
        ];
    }

    private function engagedBy(Place $place, string $attribute, string $relation, ?int $viewerId): bool
    {
        if (! $viewerId) {
            return false;
        }

        if (array_key_exists($attribute, $place->getAttributes())) {
            return (bool) $place->getAttribute($attribute);
        }

        return $place->{$relation}()->where('user_id', $viewerId)->exists();
    }

    private function user(?User $user, int $fallbackId, bool $withAvatar): array
    {
        $data = [
            'id' => $user?->id ?? $fallbackId,
            'name' => $user?->name ?? 'مستخدم محذوف',
        ];

        if ($withAvatar) {
            $data['avatar_url'] = $user?->avatar_url;
        }

        return $data;
    }
}
