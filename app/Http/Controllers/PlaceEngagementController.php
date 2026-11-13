<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlaceSave;
use App\Services\Places\PlacePresenter;
use Illuminate\Http\Request;

class PlaceEngagementController extends Controller
{
  public function save(Request $request, int $id)
  {
    $place = $this->approvedPlace($id);
    if (!$place) {
      return response()->json(['message' => 'العنصر غير موجود.'], 404);
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
      return response()->json(['message' => 'العنصر غير موجود.'], 404);
    }

    $deleted = PlaceSave::where('place_id', $place->id)->where('user_id', $request->user()->id)->delete();
    if ($deleted) {
      $place->decrement('saves_count');
    }

    return response()->json(['saved' => false, 'saves_count' => $place->saves_count]);
  }

  public function mySaves(Request $request, PlacePresenter $presenter)
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
      ->through(fn ($p) => $presenter->publicListItem($p));

    return response()->json($places);
  }

  private function approvedPlace(int $id): ?Place
  {
    return Place::where('status', 'approved')->find($id);
  }
}
