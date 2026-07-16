<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlaceComment;
use App\Models\PlaceLike;
use App\Models\PlaceReport;
use App\Models\PlaceSave;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PlaceEngagementController extends Controller
{
  public function comments(int $id)
  {
    $place = $this->approvedPlace($id);
    if (!$place) {
      return response()->json(['message' => 'Not found'], 404);
    }

    $comments = $place->comments()
      ->with('user')
      ->latest()
      ->paginate(20)
      ->through(fn ($c) => $this->commentItem($c));

    return response()->json($comments);
  }

  public function storeComment(Request $request, int $id)
  {
    if ($request->user()->is_banned) {
      return response()->json(['message' => 'تم حظر حسابك من المساهمة'], 403);
    }

    $place = $this->approvedPlace($id);
    if (!$place) {
      return response()->json(['message' => 'Not found'], 404);
    }

    $validated = $request->validate(['body' => 'required|string|max:500']);

    $comment = PlaceComment::create([
      'place_id' => $place->id,
      'user_id' => $request->user()->id,
      'body' => $validated['body'],
    ]);
    $place->increment('comments_count');

    return response()->json($this->commentItem($comment->load('user')), 201);
  }

  public function destroyComment(Request $request, int $id)
  {
    $comment = PlaceComment::findOrFail($id);
    $user = $request->user();

    if ($user->id !== $comment->user_id && !in_array($user->role, ['admin', 'superadmin'])) {
      return response()->json(['message' => 'Forbidden'], 403);
    }

    $comment->delete();
    Place::where('id', $comment->place_id)->decrement('comments_count');

    return response()->json(null, 204);
  }

  public function like(Request $request, int $id)
  {
    $place = $this->approvedPlace($id);
    if (!$place) {
      return response()->json(['message' => 'Not found'], 404);
    }

    $like = PlaceLike::firstOrCreate(['place_id' => $place->id, 'user_id' => $request->user()->id]);
    if ($like->wasRecentlyCreated) {
      $place->increment('likes_count');
    }

    return response()->json(['liked' => true, 'likes_count' => $place->likes_count]);
  }

  public function unlike(Request $request, int $id)
  {
    $place = $this->approvedPlace($id);
    if (!$place) {
      return response()->json(['message' => 'Not found'], 404);
    }

    $deleted = PlaceLike::where('place_id', $place->id)->where('user_id', $request->user()->id)->delete();
    if ($deleted) {
      $place->decrement('likes_count');
    }

    return response()->json(['liked' => false, 'likes_count' => $place->likes_count]);
  }

  public function save(Request $request, int $id)
  {
    $place = $this->approvedPlace($id);
    if (!$place) {
      return response()->json(['message' => 'Not found'], 404);
    }

    $save = PlaceSave::firstOrCreate(['place_id' => $place->id, 'user_id' => $request->user()->id]);
    if ($save->wasRecentlyCreated) {
      $place->increment('saves_count');
    }

    return response()->json(['saved' => true, 'saves_count' => $place->saves_count]);
  }

  public function unsave(Request $request, int $id)
  {
    $place = $this->approvedPlace($id);
    if (!$place) {
      return response()->json(['message' => 'Not found'], 404);
    }

    $deleted = PlaceSave::where('place_id', $place->id)->where('user_id', $request->user()->id)->delete();
    if ($deleted) {
      $place->decrement('saves_count');
    }

    return response()->json(['saved' => false, 'saves_count' => $place->saves_count]);
  }

  public function report(Request $request, int $id)
  {
    if ($request->user()->is_banned) {
      return response()->json(['message' => 'تم حظر حسابك من المساهمة'], 403);
    }

    $place = $this->approvedPlace($id);
    if (!$place) {
      return response()->json(['message' => 'Not found'], 404);
    }

    $validated = $request->validate([
      'reason' => 'required|string|in:spam,wrong_info,inappropriate,duplicate,other',
      'details' => 'nullable|string|max:1000',
    ]);

    $exists = PlaceReport::where('place_id', $place->id)->where('user_id', $request->user()->id)->exists();
    if ($exists) {
      return response()->json(['message' => 'تم استلام بلاغك مسبقاً']);
    }

    PlaceReport::create([
      'place_id' => $place->id,
      'user_id' => $request->user()->id,
      'reason' => $validated['reason'],
      'details' => $validated['details'] ?? null,
    ]);

    return response()->json(['message' => 'تم استلام البلاغ'], 201);
  }

  public function mySaves(Request $request)
  {
    // Join instead of whereHas so the list orders by when the user saved, not by place age.
    $places = Place::query()
      ->join('place_saves', 'place_saves.place_id', '=', 'places.id')
      ->where('place_saves.user_id', $request->user()->id)
      ->where('places.status', 'approved')
      ->orderByDesc('place_saves.created_at')
      ->select('places.*')
      ->with(PlaceController::thumbPhotos())
      ->paginate(20)
      ->through(fn ($p) => $this->listItem($p));

    return response()->json($places);
  }

  private function approvedPlace(int $id): ?Place
  {
    return Place::where('status', 'approved')->find($id);
  }

  private function commentItem(PlaceComment $c): array
  {
    return [
      'id' => $c->id,
      'body' => $c->body,
      'created_at' => $c->created_at,
      'user' => ['id' => $c->user->id, 'name' => $c->user->name, 'avatar_url' => $c->user->avatar_url],
    ];
  }

  private function listItem(Place $p): array
  {
    return [
      'id' => $p->id,
      'name' => $p->name,
      'category' => $p->category,
      'description' => $p->description,
      'lat' => $p->lat,
      'lng' => $p->lng,
      'thumb_url' => ($photo = $p->photos->first()) ? Storage::url($photo->thumb_path) : null,
      'likes_count' => $p->likes_count,
      'saves_count' => $p->saves_count,
      'comments_count' => $p->comments_count,
    ];
  }
}
