<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\City;
use App\Models\Route;
use App\Models\Stop;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class TransitController extends Controller
{
    public function getCities()
    {
        $formatted = Cache::remember('transit:cities', 3600, function () {
            $cities = City::select(
                'id', 'name_ar', 'name_en', 'zoom', 'status',
                DB::raw('ST_AsGeoJSON(center) as center_geojson'),
                DB::raw('ST_AsGeoJSON(bounds) as bounds_geojson')
            )->withCount(['routes as routeCount' => fn($q) => $q->where('status', 'published')])->get();

            return $cities->map(function ($city) {
                $centerJson = json_decode($city->center_geojson, true);
                $boundsJson = json_decode($city->bounds_geojson, true);

                $minLng = $boundsJson['coordinates'][0][0][0];
                $minLat = $boundsJson['coordinates'][0][0][1];
                $maxLng = $boundsJson['coordinates'][0][2][0];
                $maxLat = $boundsJson['coordinates'][0][2][1];

                return [
                    'id' => $city->id,
                    'nameAr' => $city->name_ar,
                    'nameEn' => $city->name_en,
                    'status' => $city->status,
                    'zoom' => $city->zoom,
                    'center' => $centerJson['coordinates'],
                    'bounds' => [
                        [$minLng, $minLat],
                        [$maxLng, $maxLat]
                    ],
                    'routeCount' => $city->routeCount,
                ];
            });
        });

        return response()->json($formatted);
    }

    public function getRoutes($id)
    {
        $routes = Route::where('city_id', $id)->where('status', 'published')->get();
        return response()->json($routes->map(function ($r) {
            return [
                'id' => $r->id,
                'nameAr' => $r->name_ar,
                'nameEn' => $r->name_en,
                'colorIndex' => $r->color_index,
                'priceOld' => $r->price_old,
                'priceNew' => $r->price_new,
            ];
        }));
    }

    public function getMapData($id)
    {
        $data = Cache::remember("transit:map-data:{$id}", 600, function () use ($id) {
            $routeGeometries = DB::table('route_geometries')
                ->join('routes', 'route_geometries.route_id', '=', 'routes.id')
                ->where('routes.city_id', $id)
                ->where('routes.status', 'published')
                ->select('routes.*', DB::raw('ST_AsGeoJSON(route_geometries.geometry) as geojson'))
                ->get();

            $routeFeatures = $routeGeometries->map(function ($r) {
                return [
                    'type' => 'Feature',
                    'geometry' => json_decode($r->geojson, true),
                    'properties' => [
                        'id' => $r->id,
                        'nameAr' => $r->name_ar,
                        'nameEn' => $r->name_en,
                        'colorIndex' => $r->color_index,
                        'priceOld' => $r->price_old,
                        'priceNew' => $r->price_new,
                    ],
                ];
            });

            $stops = DB::table('stops')
                ->where('city_id', $id)
                ->select('id', 'name_ar', DB::raw('ST_AsGeoJSON(geometry) as geojson'))
                ->get();

            // Batch load all route associations — one query instead of one per stop
            $stopIds = $stops->pluck('id');
            $routeMap = DB::table('route_stop')
                ->whereIn('stop_id', $stopIds)
                ->select('stop_id', 'route_id')
                ->get()
                ->groupBy('stop_id')
                ->map(fn($rows) => $rows->pluck('route_id')->values());

            $stopFeatures = $stops->map(function ($s) use ($routeMap) {
                return [
                    'type' => 'Feature',
                    'geometry' => json_decode($s->geojson, true),
                    'properties' => [
                        'id' => $s->id,
                        'nameAr' => $s->name_ar,
                        'routeIds' => $routeMap->get($s->id, collect())->values(),
                    ]
                ];
            });

            return [
                'routes' => [
                    'type' => 'FeatureCollection',
                    'features' => $routeFeatures
                ],
                'stops' => [
                    'type' => 'FeatureCollection',
                    'features' => $stopFeatures
                ]
            ];
        });

        return response()->json($data)->header('Cache-Control', 'public, max-age=600');
    }

    public function getNearbyStops(Request $request)
    {
        $request->validate([
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
            'radius' => 'nullable|numeric'
        ]);

        $lat = $request->lat;
        $lng = $request->lng;
        $radius = $request->radius ?? 500;

        $point = "POINT($lng $lat)";

        $stops = DB::table('stops')
            ->select('id', 'name_ar', 'city_id', DB::raw('ST_AsGeoJSON(geometry) as geojson'))
            ->whereRaw("ST_Distance_Sphere(geometry, ST_GeomFromText(?)) <= ?", [$point, $radius])
            ->get();

        // Batch load routes for all nearby stops — one query instead of one per stop
        $stopIds = $stops->pluck('id');
        $routesByStop = DB::table('route_stop')
            ->join('routes', 'route_stop.route_id', '=', 'routes.id')
            ->whereIn('route_stop.stop_id', $stopIds)
            ->select('route_stop.stop_id', 'routes.id', 'routes.name_ar')
            ->get()
            ->groupBy('stop_id');

        return response()->json($stops->map(function ($s) use ($routesByStop) {
            return [
                'id' => $s->id,
                'nameAr' => $s->name_ar,
                'cityId' => $s->city_id,
                'coordinates' => json_decode($s->geojson, true)['coordinates'],
                'routes' => $routesByStop->get($s->id, collect())->map(fn($r) => [
                    'id' => $r->id,
                    'name_ar' => $r->name_ar,
                ])->values(),
            ];
        }));
    }

    public function search(Request $request)
    {
        $query = $request->input('q');
        $cityId = $request->input('city_id');

        if (empty($query)) {
            return response()->json(['routes' => [], 'stops' => []]);
        }

        $routeSearch = Route::search($query);
        if ($cityId) {
            $routeSearch->where('city_id', $cityId);
        }
        $routes = $routeSearch->get()->map(function ($route) {
            return [
                'type' => 'route',
                'id' => $route->id,
                'nameAr' => $route->name_ar,
                'nameEn' => $route->name_en,
                'cityId' => $route->city_id,
            ];
        });

        $stopSearch = Stop::search($query);
        if ($cityId) {
            $stopSearch->where('city_id', $cityId);
        }
        $stopResults = $stopSearch->get();

        // Batch geometry lookups — one query for all matching stops
        $geoMap = DB::table('stops')
            ->whereIn('id', $stopResults->pluck('id'))
            ->select('id', DB::raw('ST_AsGeoJSON(geometry) as geojson'))
            ->get()
            ->keyBy('id');

        $stops = $stopResults->map(function ($stop) use ($geoMap) {
            $geo = $geoMap->get($stop->id);
            $coordinates = $geo ? json_decode($geo->geojson, true)['coordinates'] : null;

            return [
                'type' => 'stop',
                'id' => $stop->id,
                'nameAr' => $stop->name_ar,
                'cityId' => $stop->city_id,
                'coordinates' => $coordinates,
            ];
        });

        return response()->json([
            'routes' => $routes,
            'stops' => $stops,
        ]);
    }
}
