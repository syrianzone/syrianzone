<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlacePhoto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

// Public discovery reads (guides leaderboard, photo grid), kept out of
// PlaceController so the owner flows and discovery flows evolve independently.
class PlaceDiscoveryController extends Controller
{
  public function guides(Request $request)
  {
    $validated = $request->validate(['sort' => 'sometimes|in:submissions,saves,recent']);
    $sort = $validated['sort'] ?? 'submissions';

    // 5-minute staleness is accepted: no forget hooks on moderation or saves
    $rows = Cache::remember("places:guides:{$sort}", 300, function () use ($sort) {
      $metric = ['submissions' => 'approved_count', 'saves' => 'saves_total', 'recent' => 'recent_count'][$sort];
      return Place::where('places.status', 'approved')
        ->join('users', 'users.id', '=', 'places.user_id')
        ->whereNull('users.deleted_at')
        ->where('users.is_banned', false)
        ->selectRaw(
          'places.user_id, users.name, users.avatar_url, count(*) as approved_count, '
          . 'coalesce(sum(places.saves_count), 0) as saves_total, '
          . 'sum(case when places.approved_at >= ? then 1 else 0 end) as recent_count',
          [now()->subDays(30)]
        )
        ->groupBy('places.user_id', 'users.name', 'users.avatar_url')
        ->orderByDesc($metric)
        ->orderByDesc('approved_count')
        ->orderBy('places.user_id')
        ->limit(20)
        ->get()
        ->map(fn ($r) => [
          'user_id' => (int) $r->user_id,
          'name' => $r->name,
          'avatar_url' => $r->avatar_url,
          'approved_count' => (int) $r->approved_count,
          'saves_total' => (int) $r->saves_total,
          'recent_count' => (int) $r->recent_count,
        ])
        ->values()
        ->all();
    });

    $guides = array_map(fn ($row, $i) => ['rank' => $i + 1] + $row, $rows, array_keys($rows));

    return response()->json(['sort' => $sort, 'guides' => $guides])
      ->header('Cache-Control', 'public, max-age=60');
  }

  public function photos(Request $request)
  {
    $validated = $request->validate(['user_id' => 'sometimes|integer|min:1']);

    $page = PlacePhoto::join('places', 'places.id', '=', 'place_photos.place_id')
      ->where('places.status', 'approved')
      ->when(!empty($validated['user_id']), fn ($q) => $q->where('places.user_id', $validated['user_id']))
      // place_photos.* keeps updated_at on the model so thumb_url/display_url stay versioned
      ->select(
        'place_photos.*',
        'places.name as place_name',
        'places.category as place_category',
        'places.lat as place_lat',
        'places.lng as place_lng'
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
        // lat/lng ride along so the grid can fly to the place without a second fetch
        'lat' => (float) $photo->place_lat,
        'lng' => (float) $photo->place_lng,
      ],
    ]);

    return response()->json($page)->header('Cache-Control', 'public, max-age=60');
  }
}
