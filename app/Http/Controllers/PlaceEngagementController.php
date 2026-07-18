<?php

namespace App\Http\Controllers;

use App\Models\Place;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlaceEngagementController extends Controller
{
    public function save(Request $request, int $id)
    {
        $count = $this->setSaved($id, $request->user()->id, true);

        return response()->json(['saved' => true, 'saves_count' => $count]);
    }

    public function unsave(Request $request, int $id)
    {
        $count = $this->setSaved($id, $request->user()->id, false);

        return response()->json(['saved' => false, 'saves_count' => $count]);
    }

    public function mySaves(Request $request)
    {
        $request->validate(['page' => 'sometimes|integer|min:1']);

        // Join instead of whereHas so the list orders by when the user saved, not by place age.
        $places = Place::query()
            ->join('place_saves', 'place_saves.place_id', '=', 'places.id')
            ->where('place_saves.user_id', $request->user()->id)
            ->where('places.status', 'approved')
            ->orderByDesc('place_saves.created_at')
            ->orderByDesc('place_saves.id')
            ->select('places.*')
            ->with(PlaceController::thumbPhotos())
            ->paginate(20)
            ->through(fn ($p) => $this->listItem($p));

        return response()->json($places);
    }

    private function setSaved(int $placeId, int $userId, bool $saved): int
    {
        return DB::transaction(function () use ($placeId, $userId, $saved) {
            $place = Place::where('status', 'approved')->lockForUpdate()->findOrFail($placeId);

            if ($saved) {
                DB::table('place_saves')->insertOrIgnore([
                    'place_id' => $place->id,
                    'user_id' => $userId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('place_saves')
                    ->where('place_id', $place->id)
                    ->where('user_id', $userId)
                    ->delete();
            }

            $count = DB::table('place_saves')->where('place_id', $place->id)->count();
            if ($place->saves_count !== $count) {
                $place->forceFill(['saves_count' => $count])->save();
            }

            return $count;
        });
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
            'thumb_url' => $p->photos->first()?->thumb_url,
            'saves_count' => $p->saves_count,
        ];
    }
}
