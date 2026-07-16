<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlaceSave;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PlaceEngagementController extends Controller
{
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
      'saves_count' => $p->saves_count,
    ];
  }
}
