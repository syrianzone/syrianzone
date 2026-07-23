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
        $drafts = RouteDraft::with(['user:id,name', 'city:id,name_ar,name_en', 'linkedRoute:id,name_ar,name_en'])
            ->orderBy('created_at', 'desc')->get();
        return response()->json($drafts);
    }

    public function approve(Request $request, $id)
    {
        $validated = $request->validate([
            'color_index' => 'nullable|integer|min:0',
        ]);
        $colorIndex = $validated['color_index'] ?? null;

        $draft = RouteDraft::with('linkedRoute')->findOrFail($id);

        if ($draft->status !== 'pending') {
            return response()->json(['message' => 'Draft is already ' . $draft->status], 400);
        }

        // Linked draft = edit suggestion for existing published route
        if ($draft->route_id) {
            DB::beginTransaction();
            try {
                $route = Route::findOrFail($draft->route_id);

                // Update route metadata
                $route->name_ar = $draft->name_ar;
                $route->name_en = $draft->name_en;
                $route->price_new = $draft->price;
                if ($colorIndex !== null) {
                    $route->color_index = $colorIndex;
                }
                $route->save();

                // Update geometry
                $geojson = $draft->geojson;
                $features = $geojson['features'] ?? [];
                $routeLine = null;
                $stops = [];

                foreach ($features as $feature) {
                    $type = $feature['geometry']['type'] ?? null;
                    if ($type === 'LineString' || $type === 'MultiLineString') {
                        $routeLine = $feature['geometry'];
                    } elseif ($type === 'Point') {
                        $stops[] = $feature;
                    }
                }

                // Replace geometry
                DB::table('route_geometries')->where('route_id', $route->id)->delete();
                if ($routeLine) {
                    DB::statement(
                        'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
                        [$route->id, json_encode($routeLine), now(), now()]
                    );
                }

                // Replace stops
                DB::table('route_stop')->where('route_id', $route->id)->delete();
                $order = 1;
                foreach ($stops as $stopFeature) {
                    $stopPoint = $stopFeature['geometry'];
                    $nameAr = trim($stopFeature['properties']['nameAr'] ?? '') ?: ('محطة ' . $order);
                    $stopId = 'stop-' . Str::slug($draft->city->name_en ?? $draft->city->name_ar) . '-' . Str::uuid();

                    DB::statement(
                        'INSERT INTO stops (id, city_id, name_ar, geometry, created_at, updated_at) VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)',
                        [$stopId, $draft->city_id, $nameAr, json_encode($stopPoint), now(), now()]
                    );

                    DB::table('route_stop')->insert([
                        'route_id' => $route->id,
                        'stop_id' => $stopId,
                        'order' => $order++,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                // Log the update
                \App\Models\TransitRouteLog::create([
                    'route_id' => $route->id,
                    'action' => 'updated_via_draft',
                    'description' => "تحديث الخط '{$route->name_ar}' بناءً على مساهمة #{$draft->id} من " . ($draft->user->name ?? 'مجهول'),
                    'user_id' => auth()->id(),
                ]);

                // Mark draft as approved
                $draft->status = 'approved';
                $draft->save();

                DB::commit();

                Cache::forget("transit:map-data:{$draft->city_id}");
                Cache::forget('transit:cities');

                return response()->json(['message' => 'Draft approved and route updated', 'route' => $route]);
            } catch (\Exception $e) {
                DB::rollBack();
                return response()->json(['message' => 'Failed to approve draft', 'error' => $e->getMessage()], 500);
            }
        }

        // Original flow: new route from scratch
        DB::beginTransaction();

        try {
            // Generate unique IDs
            $routeId = 'route-' . Str::slug($draft->city->name_en ?? $draft->city->name_ar) . '-' . Str::uuid();

            // Create the Route
            $route = Route::create([
                'id' => $routeId,
                'city_id' => $draft->city_id,
                'name_ar' => $draft->name_ar,
                'name_en' => $draft->name_en,
                'color_index' => $colorIndex ?? 0,
                'price_old' => null,
                'price_new' => $draft->price,
                'status' => 'published',
            ]);

            $geojson = $draft->geojson;
            $features = $geojson['features'] ?? [];

            $stops = [];
            $routeLine = null;

            foreach ($features as $feature) {
                $type = $feature['geometry']['type'] ?? null;
                if ($type === 'LineString' || $type === 'MultiLineString') {
                    $routeLine = $feature['geometry'];
                } elseif ($type === 'Point') {
                    $stops[] = $feature; // store full feature to access nameAr from properties
                }
            }

            if ($routeLine) {
                DB::statement(
                    'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
                    [$routeId, json_encode($routeLine), now(), now()]
                );
            }

            // Insert Stops and route_stop mapping
            $order = 1;
            foreach ($stops as $stopFeature) {
                $stopPoint = $stopFeature['geometry'];
                $nameAr = trim($stopFeature['properties']['nameAr'] ?? '') ?: ('محطة ' . $order);
                $stopId = 'stop-' . Str::slug($draft->city->name_en ?? $draft->city->name_ar) . '-' . Str::uuid();

                DB::statement(
                    'INSERT INTO stops (id, city_id, name_ar, geometry, created_at, updated_at) VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)',
                    [$stopId, $draft->city_id, $nameAr, json_encode($stopPoint), now(), now()]
                );

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

    public function getPublishedRoutes()
    {
        $routes = Route::with(['city:id,name_ar,name_en'])
            ->withCount('stops')
            ->get();
        return response()->json($routes);
    }

    public function getLogs()
    {
        $logs = \App\Models\TransitRouteLog::with(['user:id,name'])->orderBy('created_at', 'desc')->get();
        return response()->json($logs);
    }

    public function updateRouteStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|string|in:published,disapproved,hidden',
        ]);

        $route = Route::findOrFail($id);
        $oldStatus = $route->status;

        if ($oldStatus === $validated['status']) {
            return response()->json(['message' => 'Status is already ' . $validated['status']]);
        }

        DB::beginTransaction();
        try {
            $route->status = $validated['status'];
            $route->save();

            $actionMap = [
                'published' => 'restored',
                'disapproved' => 'disapproved',
                'hidden' => 'hidden',
            ];
            $action = $actionMap[$validated['status']] ?? 'updated_status';

            $statusLabels = [
                'published' => 'منشور',
                'disapproved' => 'ملغى (مرفوض)',
                'hidden' => 'مخفي',
            ];

            \App\Models\TransitRouteLog::create([
                'route_id' => $route->id,
                'action' => $action,
                'description' => "تغيير حالة الخط '{$route->name_ar}' من '" . ($statusLabels[$oldStatus] ?? $oldStatus) . "' إلى '" . $statusLabels[$validated['status']] . "'",
                'user_id' => auth()->id(),
            ]);

            DB::commit();

            Cache::forget("transit:map-data:{$route->city_id}");
            Cache::forget('transit:cities');

            return response()->json(['message' => 'Route status updated successfully', 'route' => $route]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update route status', 'error' => $e->getMessage()], 500);
        }
    }

    public function moveRoute(Request $request, $id)
    {
        $validated = $request->validate([
            'city_id' => 'required|string|exists:cities,id',
        ]);

        $route = Route::findOrFail($id);
        $oldCityId = $route->city_id;
        $targetCityId = $validated['city_id'];

        if ($oldCityId === $targetCityId) {
            return response()->json(['message' => 'Route is already in this city'], 400);
        }

        $oldCityName = DB::table('cities')->where('id', $oldCityId)->value('name_ar') ?? $oldCityId;
        $newCityName = DB::table('cities')->where('id', $targetCityId)->value('name_ar') ?? $targetCityId;

        DB::beginTransaction();
        try {
            $stops = $route->stops()->orderBy('pivot_order')->get();

            foreach ($stops as $stop) {
                $otherRoutesCount = DB::table('route_stop')
                    ->join('routes', 'route_stop.route_id', '=', 'routes.id')
                    ->where('route_stop.stop_id', $stop->id)
                    ->where('route_stop.route_id', '!=', $route->id)
                    ->where('routes.city_id', $oldCityId)
                    ->count();

                if ($otherRoutesCount === 0) {
                    $stop->city_id = $targetCityId;
                    $stop->save();
                } else {
                    $newStopId = 'stop-' . Str::slug($targetCityId) . '-' . Str::uuid();
                    $geomGeojson = DB::table('stops')
                        ->selectRaw('ST_AsGeoJSON(geometry) as geojson')
                        ->where('id', $stop->id)
                        ->value('geojson');

                    DB::statement(
                        'INSERT INTO stops (id, city_id, name_ar, geometry, created_at, updated_at) VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)',
                        [$newStopId, $targetCityId, $stop->name_ar, $geomGeojson, now(), now()]
                    );

                    DB::table('route_stop')
                        ->where('route_id', $route->id)
                        ->where('stop_id', $stop->id)
                        ->update([
                            'stop_id' => $newStopId,
                            'updated_at' => now(),
                        ]);
                }
            }

            $route->city_id = $targetCityId;
            $route->save();

            \App\Models\TransitRouteLog::create([
                'route_id' => $route->id,
                'action' => 'moved',
                'description' => "نقل الخط '{$route->name_ar}' من مدينة '{$oldCityName}' إلى مدينة '{$newCityName}'",
                'user_id' => auth()->id(),
            ]);

            DB::commit();

            Cache::forget("transit:map-data:{$oldCityId}");
            Cache::forget("transit:map-data:{$targetCityId}");
            Cache::forget('transit:cities');

            return response()->json(['message' => 'Route moved successfully', 'route' => $route]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to move route', 'error' => $e->getMessage()], 500);
        }
    }

    public function combineRoutes(Request $request)
    {
        $validated = $request->validate([
            'route_a_id' => 'required|string|exists:routes,id',
            'route_b_id' => 'required|string|exists:routes,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'price' => 'nullable|integer',
        ]);

        $routeA = Route::findOrFail($validated['route_a_id']);
        $routeB = Route::findOrFail($validated['route_b_id']);

        if ($routeA->city_id !== $routeB->city_id) {
            return response()->json(['message' => 'Routes must belong to the same city'], 400);
        }

        $cityId = $routeA->city_id;
        $cityName = DB::table('cities')->where('id', $cityId)->value('name_en') ?? 'transit';

        DB::beginTransaction();
        try {
            $newRouteId = 'route-' . Str::slug($cityName) . '-' . Str::uuid();
            $newRoute = Route::create([
                'id' => $newRouteId,
                'city_id' => $cityId,
                'name_ar' => $validated['name_ar'],
                'name_en' => $validated['name_en'] ?? null,
                'price_old' => null,
                'price_new' => $validated['price'] ?? max($routeA->price_new ?? 0, $routeB->price_new ?? 0),
                'status' => 'published',
            ]);

            $geomAJson = DB::table('route_geometries')->selectRaw('ST_AsGeoJSON(geometry) as geojson')->where('route_id', $routeA->id)->value('geojson');
            $geomBJson = DB::table('route_geometries')->selectRaw('ST_AsGeoJSON(geometry) as geojson')->where('route_id', $routeB->id)->value('geojson');

            $coordsA = [];
            $coordsB = [];

            if ($geomAJson) {
                $geomA = json_decode($geomAJson, true);
                $coordsA = $geomA['coordinates'] ?? [];
                if (($geomA['type'] ?? '') === 'MultiLineString') {
                    $coordsA = array_merge(...$coordsA);
                }
            }
            if ($geomBJson) {
                $geomB = json_decode($geomBJson, true);
                $coordsB = $geomB['coordinates'] ?? [];
                if (($geomB['type'] ?? '') === 'MultiLineString') {
                    $coordsB = array_merge(...$coordsB);
                }
            }

            $mergedCoords = array_merge($coordsA, $coordsB);

            if (count($mergedCoords) > 0) {
                $newLineString = [
                    'type' => 'LineString',
                    'coordinates' => $mergedCoords,
                ];
                DB::statement(
                    'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
                    [$newRouteId, json_encode($newLineString), now(), now()]
                );
            }

            $stopsA = $routeA->stops()->orderBy('pivot_order')->get();
            $stopsB = $routeB->stops()->orderBy('pivot_order')->get();

            $order = 1;
            foreach ($stopsA as $stop) {
                DB::table('route_stop')->insert([
                    'route_id' => $newRouteId,
                    'stop_id' => $stop->id,
                    'order' => $order++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            foreach ($stopsB as $stop) {
                $isDuplicate = DB::table('route_stop')
                    ->where('route_id', $newRouteId)
                    ->where('stop_id', $stop->id)
                    ->exists();

                if (!$isDuplicate) {
                    DB::table('route_stop')->insert([
                        'route_id' => $newRouteId,
                        'stop_id' => $stop->id,
                        'order' => $order++,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            $routeA->status = 'disapproved';
            $routeA->save();
            $routeB->status = 'disapproved';
            $routeB->save();

            \App\Models\TransitRouteLog::create([
                'route_id' => $newRoute->id,
                'action' => 'combined',
                'description' => "دمج الخطين '{$routeA->name_ar}' و '{$routeB->name_ar}' في خط جديد باسم '{$newRoute->name_ar}'",
                'user_id' => auth()->id(),
            ]);

            DB::commit();

            Cache::forget("transit:map-data:{$cityId}");
            Cache::forget('transit:cities');

            return response()->json(['message' => 'Routes combined successfully', 'route' => $newRoute]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to combine routes', 'error' => $e->getMessage()], 500);
        }
    }

    public function splitRoute(Request $request)
    {
        $validated = $request->validate([
            'route_id' => 'required|string|exists:routes,id',
            'split_stop_id' => 'required|string|exists:stops,id',
            'name_a_ar' => 'required|string|max:255',
            'name_a_en' => 'nullable|string|max:255',
            'name_b_ar' => 'required|string|max:255',
            'name_b_en' => 'nullable|string|max:255',
        ]);

        $route = Route::findOrFail($validated['route_id']);
        $cityId = $route->city_id;
        $cityName = DB::table('cities')->where('id', $cityId)->value('name_en') ?? 'transit';

        DB::beginTransaction();
        try {
            $stops = $route->stops()->orderBy('pivot_order')->get();

            $splitIndex = -1;
            foreach ($stops as $idx => $stop) {
                if ($stop->id === $validated['split_stop_id']) {
                    $splitIndex = $idx;
                    break;
                }
            }

            if ($splitIndex === -1 || $splitIndex === 0 || $splitIndex === count($stops) - 1) {
                return response()->json(['message' => 'Invalid split stop: cannot split at start or end stop'], 400);
            }

            $geomJson = DB::table('route_geometries')->selectRaw('ST_AsGeoJSON(geometry) as geojson')->where('route_id', $route->id)->value('geojson');
            $coords = [];

            if ($geomJson) {
                $geom = json_decode($geomJson, true);
                $coords = $geom['coordinates'] ?? [];
                if (($geom['type'] ?? '') === 'MultiLineString') {
                    $coords = array_merge(...$coords);
                }
            }

            $splitStopGeomJson = DB::table('stops')->selectRaw('ST_AsGeoJSON(geometry) as geojson')->where('id', $validated['split_stop_id'])->value('geojson');
            $splitStopCoords = [0, 0];
            if ($splitStopGeomJson) {
                $splitStopGeom = json_decode($splitStopGeomJson, true);
                $splitStopCoords = $splitStopGeom['coordinates'] ?? [0, 0];
            }

            $closestIndex = 0;
            $minDist = 99999999;
            foreach ($coords as $cIdx => $coord) {
                $dist = pow($coord[0] - $splitStopCoords[0], 2) + pow($coord[1] - $splitStopCoords[1], 2);
                if ($dist < $minDist) {
                    $minDist = $dist;
                    $closestIndex = $cIdx;
                }
            }

            $coordsA = array_slice($coords, 0, $closestIndex + 1);
            $coordsB = array_slice($coords, $closestIndex);

            $routeAId = 'route-' . Str::slug($cityName) . '-' . Str::uuid();
            $routeA = Route::create([
                'id' => $routeAId,
                'city_id' => $cityId,
                'name_ar' => $validated['name_a_ar'],
                'name_en' => $validated['name_a_en'] ?? null,
                'price_old' => null,
                'price_new' => $route->price_new,
                'status' => 'published',
            ]);

            if (count($coordsA) > 1) {
                $lineA = ['type' => 'LineString', 'coordinates' => $coordsA];
                DB::statement(
                    'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
                    [$routeAId, json_encode($lineA), now(), now()]
                );
            }

            $routeBId = 'route-' . Str::slug($cityName) . '-' . Str::uuid();
            $routeB = Route::create([
                'id' => $routeBId,
                'city_id' => $cityId,
                'name_ar' => $validated['name_b_ar'],
                'name_en' => $validated['name_b_en'] ?? null,
                'price_old' => null,
                'price_new' => $route->price_new,
                'status' => 'published',
            ]);

            if (count($coordsB) > 1) {
                $lineB = ['type' => 'LineString', 'coordinates' => $coordsB];
                DB::statement(
                    'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
                    [$routeBId, json_encode($lineB), now(), now()]
                );
            }

            $orderA = 1;
            for ($i = 0; $i <= $splitIndex; $i++) {
                DB::table('route_stop')->insert([
                    'route_id' => $routeAId,
                    'stop_id' => $stops[$i]->id,
                    'order' => $orderA++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $orderB = 1;
            for ($i = $splitIndex; $i < count($stops); $i++) {
                DB::table('route_stop')->insert([
                    'route_id' => $routeBId,
                    'stop_id' => $stops[$i]->id,
                    'order' => $orderB++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $route->status = 'disapproved';
            $route->save();

            \App\Models\TransitRouteLog::create([
                'route_id' => $route->id,
                'action' => 'split',
                'description' => "تقسيم الخط '{$route->name_ar}' إلى خطين: '{$routeA->name_ar}' و '{$routeB->name_ar}' عند موقف '{$stops[$splitIndex]->name_ar}'",
                'user_id' => auth()->id(),
            ]);

            DB::commit();

            Cache::forget("transit:map-data:{$cityId}");
            Cache::forget('transit:cities');

            return response()->json(['message' => 'Route split successfully', 'route_a' => $routeA, 'route_b' => $routeB]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to split route', 'error' => $e->getMessage()], 500);
        }
    }

    public function getRouteStops($id)
    {
        $route = Route::findOrFail($id);
        $stops = $route->stops()->orderBy('pivot_order')->get();
        $formatted = $stops->map(function ($s) {
            $geomJson = DB::table('stops')->selectRaw('ST_AsGeoJSON(geometry) as geojson')->where('id', $s->id)->value('geojson');
            $coords = json_decode($geomJson, true)['coordinates'] ?? [0, 0];
            return [
                'id' => $s->id,
                'name_ar' => $s->name_ar,
                'coordinates' => $coords,
            ];
        });
        return response()->json($formatted);
    }

    public function getRouteGeoJson($id)
    {
        $route = Route::findOrFail($id);
        $geomJson = DB::table('route_geometries')->selectRaw('ST_AsGeoJSON(geometry) as geojson')->where('route_id', $route->id)->value('geojson');

        $features = [];
        if ($geomJson) {
            $features[] = [
                'type' => 'Feature',
                'geometry' => json_decode($geomJson, true),
                'properties' => [
                    'id' => $route->id,
                    'nameAr' => $route->name_ar,
                    'colorIndex' => $route->color_index,
                ]
            ];
        }

        $stops = $route->stops()->orderBy('pivot_order')->get();
        foreach ($stops as $s) {
            $stopGeomJson = DB::table('stops')->selectRaw('ST_AsGeoJSON(geometry) as geojson')->where('id', $s->id)->value('geojson');
            if ($stopGeomJson) {
                $features[] = [
                    'type' => 'Feature',
                    'geometry' => json_decode($stopGeomJson, true),
                    'properties' => [
                        'id' => $s->id,
                        'nameAr' => $s->name_ar,
                    ]
                ];
            }
        }

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features
        ]);
    }

    public function updateRoute(Request $request, $id)
    {
        $route = Route::findOrFail($id);

        $validated = $request->validate([
            'name_ar' => 'sometimes|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'color_index' => 'nullable|integer|min:0',
            'price_new' => 'nullable|integer',
            'price_old' => 'nullable|integer',
        ]);

        $updateData = [];
        if ($request->has('name_ar')) $updateData['name_ar'] = $validated['name_ar'];
        if ($request->has('name_en')) $updateData['name_en'] = $validated['name_en'];
        if ($request->has('color_index')) $updateData['color_index'] = $validated['color_index'];
        if ($request->has('price_new')) $updateData['price_new'] = $validated['price_new'];
        if ($request->has('price_old')) $updateData['price_old'] = $validated['price_old'];

        if (empty($updateData)) {
            return response()->json(['message' => 'No fields to update'], 400);
        }

        $route->update($updateData);

        $changes = [];
        if (isset($updateData['name_ar'])) $changes[] = "الاسم من '{$route->getOriginal('name_ar')}' إلى '{$updateData['name_ar']}'";
        if (isset($updateData['name_en'])) $changes[] = "الاسم الإنجليزي";
        if (isset($updateData['color_index'])) $changes[] = "لون المسار";
        if (isset($updateData['price_new'])) $changes[] = "التعرفة من '{$route->getOriginal('price_new')}' إلى '{$updateData['price_new']}'";

        \App\Models\TransitRouteLog::create([
            'route_id' => $route->id,
            'action' => 'admin_updated',
            'description' => "تعديل مباشر للخط '{$route->name_ar}': " . implode(', ', $changes),
            'user_id' => auth()->id(),
        ]);

        Cache::forget("transit:map-data:{$route->city_id}");
        Cache::forget('transit:cities');

        return response()->json(['message' => 'Route updated', 'route' => $route->fresh()]);
    }
}
