<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlaceReport;
use App\Services\PlaceImageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
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
      ->withCount('reports')
      ->withExists([
        'likes as liked_by_me' => fn ($q) => $q->where('user_id', $userId),
        'saves as saved_by_me' => fn ($q) => $q->where('user_id', $userId),
      ])
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

  public function reports(Request $request)
  {
    $validated = $request->validate(['status' => 'sometimes|in:open,resolved,dismissed,all']);
    $status = $validated['status'] ?? 'open';

    $query = PlaceReport::with(['user', 'place'])->latest();
    if ($status !== 'all') {
      $query->where('status', $status);
    }

    $reports = $query->paginate(20)->through(fn ($r) => [
      'id' => $r->id,
      'reason' => $r->reason,
      'details' => $r->details,
      'status' => $r->status,
      'created_at' => $r->created_at,
      'user' => ['id' => $r->user->id, 'name' => $r->user->name],
      'place' => ['id' => $r->place->id, 'name' => $r->place->name, 'status' => $r->place->status],
    ]);

    return response()->json($reports);
  }

  public function resolveReport(Request $request, int $id)
  {
    $report = PlaceReport::findOrFail($id);
    $validated = $request->validate(['action' => 'required|string|in:resolve,dismiss']);

    $status = $validated['action'] === 'resolve' ? 'resolved' : 'dismissed';
    $report->update(['status' => $status]);

    return response()->json(['id' => $report->id, 'status' => $status]);
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
      'thumb_url' => ($photo = $p->photos->first()) ? Storage::url($photo->thumb_path) : null,
      'likes_count' => $p->likes_count,
      'saves_count' => $p->saves_count,
      'comments_count' => $p->comments_count,
      'status' => $p->status,
      'user' => ['id' => $p->user->id, 'name' => $p->user->name, 'avatar_url' => $p->user->avatar_url],
      'photos' => $p->photos->map(fn ($photo) => [
        'id' => $photo->id,
        'thumb_url' => Storage::url($photo->thumb_path),
        'display_url' => Storage::url($photo->display_path),
        'sort' => $photo->sort,
      ])->values(),
      'liked_by_me' => (bool) $p->liked_by_me,
      'saved_by_me' => (bool) $p->saved_by_me,
      'created_at' => $p->created_at,
      'rejection_reason' => $p->rejection_reason,
      'reports_count' => $p->reports_count,
    ];
  }
}
