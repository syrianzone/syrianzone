<?php

namespace App\Http\Controllers;

use App\Models\RouteDraft;
use App\Models\Route;
use App\Models\RouteGeometry;
use App\Models\Stop;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TransitAdminController extends Controller
{
    public function index()
    {
        $drafts = RouteDraft::with(['user:id,name', 'city:id,name_ar,name_en'])->orderBy('created_at', 'desc')->get();
        return response()->json($drafts);
    }

    public function approve(Request $request, $id)
    {
        $draft = RouteDraft::findOrFail($id);

        if ($draft->status !== 'pending') {
            return response()->json(['message' => 'Draft is already ' . $draft->status], 400);
        }

        DB::beginTransaction();

        try {
            // Generate unique IDs
            $routeId = 'route-' . Str::slug($draft->city->name_en ?? $draft->city->name_ar) . '-' . uniqid();

            // Create the Route
            $route = Route::create([
                'id' => $routeId,
                'city_id' => $draft->city_id,
                'name_ar' => $draft->name_ar,
                'name_en' => $draft->name_en,
                'price_old' => null,
                'price_new' => $draft->price,
                'status' => 'published',
            ]);

            $geojson = $draft->geojson;
            $features = $geojson['features'] ?? [];

            $stops = [];
            $routeLine = null;

            foreach ($features as $feature) {
                if ($feature['geometry']['type'] === 'LineString' || $feature['geometry']['type'] === 'MultiLineString') {
                    $routeLine = $feature['geometry'];
                } elseif ($feature['geometry']['type'] === 'Point') {
                    $stops[] = $feature; // store full feature to access nameAr from properties
                }
            }

            if ($routeLine) {
                // Insert RouteGeometry
                DB::table('route_geometries')->insert([
                    'route_id' => $routeId,
                    'geometry' => DB::raw("ST_GeomFromGeoJSON('" . json_encode($routeLine) . "')"),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Insert Stops and route_stop mapping
            $order = 1;
            foreach ($stops as $stopFeature) {
                $stopPoint = $stopFeature['geometry'];
                $nameAr = trim($stopFeature['properties']['nameAr'] ?? '') ?: ('محطة ' . $order);
                $stopId = 'stop-' . Str::slug($draft->city->name_en ?? $draft->city->name_ar) . '-' . uniqid();

                DB::table('stops')->insert([
                    'id' => $stopId,
                    'city_id' => $draft->city_id,
                    'name_ar' => $nameAr,
                    'geometry' => DB::raw("ST_GeomFromGeoJSON('" . json_encode($stopPoint) . "')"),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('route_stop')->insert([
                    'route_id' => $routeId,
                    'stop_id' => $stopId,
                    'order' => $order++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Mark draft as approved
            $draft->status = 'approved';
            $draft->save();

            DB::commit();

            Cache::forget("transit:map-data:{$draft->city_id}");
            Cache::forget('transit:cities');

            return response()->json(['message' => 'Draft approved', 'route' => $route]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to approve draft', 'error' => $e->getMessage()], 500);
        }
    }

    public function reject(Request $request, $id)
    {
        $validated = $request->validate(['reason' => 'nullable|string|max:1000']);

        $draft = RouteDraft::findOrFail($id);

        if ($draft->status !== 'pending') {
            return response()->json(['message' => 'Draft is already ' . $draft->status], 400);
        }

        $draft->status = 'rejected';
        $draft->rejection_reason = $validated['reason'] ?? null;
        $draft->save();

        return response()->json(['message' => 'Draft rejected']);
    }
}
