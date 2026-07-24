<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\GuideLevelService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

// Public discovery reads stay separate from owner mutation flows.
class PlaceDiscoveryController extends Controller
{
    public function guides(Request $request, GuideLevelService $levels)
    {
        $validated = $request->validate([
            'sort' => 'sometimes|in:points,submissions,saves,recent',
        ]);
        $sort = $validated['sort'] ?? 'points';

        $rows = Cache::remember("places:guides:{$sort}", 300, function () use ($sort, $levels) {
            $rows = Place::where('places.status', 'approved')
                ->join('users', 'users.id', '=', 'places.user_id')
                ->whereNull('users.deleted_at')
                ->where('users.is_banned', false)
                ->selectRaw(
                    'places.user_id, users.name, users.avatar_url, count(*) as approved_count, '
                    .'coalesce(sum(places.saves_count), 0) as saves_total, '
                    .'sum(case when places.approved_at >= ? then 1 else 0 end) as recent_count',
                    [now()->subDays(30)],
                )
                ->groupBy('places.user_id', 'users.name', 'users.avatar_url')
                ->get()
                ->map(fn ($row) => [
                    'user_id' => (int) $row->user_id,
                    'name' => $row->name,
                    'avatar_url' => $row->avatar_url,
                    'approved_count' => (int) $row->approved_count,
                    'saves_total' => (int) $row->saves_total,
                    'recent_count' => (int) $row->recent_count,
                ])
                ->values()
                ->all();

            $pointsByUser = $levels->forUsers(array_column($rows, 'user_id'));
            $rows = array_map(function ($row) use ($pointsByUser) {
                $entry = $pointsByUser[$row['user_id']] ?? [
                    'points' => 0,
                    'level' => 1,
                ];

                return $row + [
                    'points' => $entry['points'],
                    'level' => $entry['level'],
                ];
            }, $rows);

            $metric = [
                'points' => 'points',
                'submissions' => 'approved_count',
                'saves' => 'saves_total',
                'recent' => 'recent_count',
            ][$sort];
            usort(
                $rows,
                fn ($left, $right) => [
                    $right[$metric],
                    $right['points'],
                    $left['user_id'],
                ] <=> [
                    $left[$metric],
                    $left['points'],
                    $right['user_id'],
                ],
            );

            return array_slice($rows, 0, 20);
        });

        $guides = array_map(
            fn ($row, $index) => ['rank' => $index + 1] + $row,
            $rows,
            array_keys($rows),
        );

        return response()->json(['sort' => $sort, 'guides' => $guides])
            ->header('Cache-Control', 'public, max-age=60');
    }

    public function photos(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'sometimes|integer|min:1',
        ]);

        $page = PlacePhoto::join('places', 'places.id', '=', 'place_photos.place_id')
            ->where('places.status', 'approved')
            ->when(
                ! empty($validated['user_id']),
                fn ($query) => $query->where('places.user_id', $validated['user_id']),
            )
            ->select(
                'place_photos.*',
                'places.name as place_name',
                'places.category as place_category',
                'places.lat as place_lat',
                'places.lng as place_lng',
            )
            ->orderByDesc('place_photos.id')
            ->paginate(24);

        $page->through(fn ($photo) => [
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
        ]);

        return response()->json($page)
            ->header('Cache-Control', 'public, max-age=60');
    }
}
