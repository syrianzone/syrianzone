<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\PlaceImageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class PlaceAdminController extends Controller
{
  public function renderIndex()
  {
    return Inertia::render('Admin/Places/Index');
  }

  public function index(Request $request)
  {
    $validated = $request->validate(['status' => 'sometimes|in:pending,approved,rejected,all']);
    $status = $validated['status'] ?? 'pending';
    $userId = $request->user()->id;

    $query = Place::with(['user', 'photos'])
      ->withExists(['saves as saved_by_me' => fn ($q) => $q->where('user_id', $userId)])
      ->latest();

    if ($status !== 'all') {
      $query->where('status', $status);
    }

    return response()->json($query->paginate(20)->through(fn ($p) => $this->adminItem($p)));
  }

  public function approve(int $id)
  {
    $place = Place::findOrFail($id);

    if ($place->status !== 'pending') {
      return response()->json(['message' => "Place is already {$place->status}"], 400);
    }

    $place->update(['status' => 'approved', 'approved_at' => now()]);
    Cache::forget('places:map');

    return response()->json(['id' => $place->id, 'status' => 'approved']);
  }

  public function reject(Request $request, int $id)
  {
    $place = Place::findOrFail($id);

    if ($place->status !== 'pending') {
      return response()->json(['message' => "Place is already {$place->status}"], 400);
    }

    $validated = $request->validate(['reason' => 'nullable|string|max:1000']);
    $place->update(['status' => 'rejected', 'rejection_reason' => $validated['reason'] ?? null]);

    return response()->json(['id' => $place->id, 'status' => 'rejected']);
  }

  public function destroy(int $id, PlaceImageService $images)
  {
    $place = Place::with('photos')->findOrFail($id);

    foreach ($place->photos as $photo) {
      $images->deleteFiles($photo);
    }
    $place->delete();
    Cache::forget('places:map');

    return response()->json(null, 204);
  }

  public function rotatePhoto(int $id, PlaceImageService $images)
  {
    $photo = PlacePhoto::findOrFail($id);
    try {
      $images->rotateClockwise($photo);
    } catch (\RuntimeException $e) {
      // the file is gone from disk (cdn may still show a ghost copy): only a re-upload helps
      return response()->json(['message' => 'ملف الصورة مفقود على الخادم، استخدم إعادة الرفع'], 422);
    }
    // the map cache embeds versioned thumb urls
    Cache::forget('places:map');

    return response()->json([
      'id' => $photo->id,
      'thumb_url' => $photo->thumb_url,
      'display_url' => $photo->display_url,
    ]);
  }

  public function replacePhoto(int $id, Request $request, PlaceImageService $images)
  {
    $request->validate([
      'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:8192|dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
    ]);

    $photo = PlacePhoto::findOrFail($id);
    $images->replace($photo, $request->file('photo'));
    Cache::forget('places:map');

    return response()->json([
      'id' => $photo->id,
      'thumb_url' => $photo->thumb_url,
      'display_url' => $photo->display_url,
    ]);
  }

  private function adminItem(Place $p): array
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
      'user' => ['id' => $p->user->id, 'name' => $p->user->name, 'avatar_url' => $p->user->avatar_url],
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
}
