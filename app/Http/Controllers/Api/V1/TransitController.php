<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\City;
use App\Models\Route;
use App\Models\Stop;
use App\Services\Transit\GovernorateIconService;
use App\Services\Transit\PublishedRoutes;
use App\Support\Facts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class TransitController extends Controller
{
    /** Most results one search returns per kind (routes, stops). */
    private const SEARCH_LIMIT = 50;

    public function __construct(private readonly GovernorateIconService $governorateIcons) {}

    public function cities()
    {
        return $this->getCities();
    }

    public function getCities()
    {
        // Dedicated key: the /transit page caches the same rows under
        // 'transit:cities', but without icons (they are code-split in the
        // browser). Sharing one key would let whichever ran first decide the
        // shape, so the public API keeps its own enriched copy.
        $formatted = Cache::remember('transit:cities:api', 3600, function () {
            $cities = City::select(
                'id', 'name_ar', 'name_en', 'zoom', 'status',
                DB::raw('ST_AsGeoJSON(center) as center_geojson'),
                DB::raw('ST_AsGeoJSON(bounds) as bounds_geojson')
            )->withCount(['routes as routeCount' => fn ($q) => $q->where('status', 'published')])->get();

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
                        [$maxLng, $maxLat],
                    ],
                    'routeCount' => $city->routeCount,
                    'icon' => $this->governorateIcons->forCity($city->id),
                ];
            });
        });

        return response()->json($formatted);
    }

    /**
     * City ids a public endpoint serves for the given city: the Damascus metro
     * pair is one network (routes cross the boundary), everything else is
     * itself. Unknown ids 404 — a cached empty 200 would hide typos and
     * renamed cities.
     *
     * @return array<int, string>
     */
    private function cityIdsFor(string $id): array
    {
        if (! City::whereKey($id)->exists()) {
            abort(404, 'City not found.');
        }

        return City::mapGroup($id);
    }

    public function routes($id, PublishedRoutes $routes)
    {
        return $this->getRoutes($id, $routes);
    }

    public function getRoutes($id, PublishedRoutes $routes)
    {
        $this->cityIdsFor($id);

        return response()->json($routes->forCity($id));
    }

    public function mapData($id)
    {
        return $this->getMapData($id);
    }

    public function getMapData($id)
    {
        $cityIds = $this->cityIdsFor($id);
        $data = Cache::remember("transit:map-data:{$id}", 600, function () use ($cityIds) {
            $routeGeometries = DB::table('route_geometries')
                ->join('routes', 'route_geometries.route_id', '=', 'routes.id')
                ->whereIn('routes.city_id', $cityIds)
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
                        'colorIndex' => (int) ($r->color_index ?? 0),
                        'color_index' => (int) ($r->color_index ?? 0),
                        'priceOld' => $r->price_old,
                        'priceNew' => $r->price_new,
                    ],
                ];
            });

            $stops = DB::table('stops')
                ->whereIn('city_id', $cityIds)
                ->select('id', 'name_ar', DB::raw('ST_AsGeoJSON(geometry) as geojson'))
                ->get();

            // Batch load all route associations — one query instead of one per stop
            $stopIds = $stops->pluck('id');
            $routeMap = DB::table('route_stop')
                ->join('routes', 'route_stop.route_id', '=', 'routes.id')
                ->whereIn('route_stop.stop_id', $stopIds)
                ->where('routes.status', 'published')
                ->select('route_stop.stop_id', 'route_stop.route_id')
                ->get()
                ->groupBy('stop_id')
                ->map(fn ($rows) => $rows->pluck('route_id')->values());

            $stopFeatures = $stops->map(function ($s) use ($routeMap) {
                return [
                    'type' => 'Feature',
                    'geometry' => json_decode($s->geojson, true),
                    'properties' => [
                        'id' => $s->id,
                        'nameAr' => $s->name_ar,
                        'routeIds' => $routeMap->get($s->id, collect())->values(),
                    ],
                ];
            });

            return [
                'routes' => [
                    'type' => 'FeatureCollection',
                    'features' => $routeFeatures,
                ],
                'stops' => [
                    'type' => 'FeatureCollection',
                    'features' => $stopFeatures,
                ],
            ];
        });

        return response()->json($data)->header('Cache-Control', 'public, max-age=600');
    }

    public function nearbyStops(Request $request)
    {
        return $this->getNearbyStops($request);
    }

    public function getNearbyStops(Request $request)
    {
        $transit = Facts::transit();

        $request->validate([
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
            'radius' => 'nullable|numeric|min:1|max:'.$transit['nearby_stops_radius_max_m'],
        ]);

        $lat = $request->lat;
        $lng = $request->lng;
        $radius = min((float) ($request->radius ?? $transit['nearby_stops_radius_m']), $transit['nearby_stops_radius_max_m']);

        // Build the comparison point through the same GeoJSON path the stops were
        // stored with (ST_GeomFromGeoJSON => SRID 4326, [lng, lat] axis order). Using
        // ST_GeomFromText here would produce SRID 0 and mismatch the column's SRID 4326,
        // causing ST_Distance_Sphere to error out on every request.
        $pointJson = json_encode(['type' => 'Point', 'coordinates' => [(float) $lng, (float) $lat]]);

        // Bounding-box prefilter, so the exact distance check only runs on
        // nearby rows: 1° lat ≈ 111km, lng scaled by cos(lat).
        //
        // The box is a GeoJSON polygon tested with MBRContains, not a pair of
        // ST_X/ST_Y ranges. On a geographic SRS MySQL returns latitude from
        // ST_X and longitude from ST_Y, so the old ranges compared longitude
        // with a latitude band and matched nothing. MBRContains has no axis to
        // get wrong and is what the spatial index on stops.geometry serves.
        $latDelta = $radius / 111000;
        $lngDelta = $radius / max(111000 * cos(deg2rad((float) $lat)), 20000);
        $minLat = (float) $lat - $latDelta;
        $maxLat = (float) $lat + $latDelta;
        $minLng = (float) $lng - $lngDelta;
        $maxLng = (float) $lng + $lngDelta;
        $boxJson = json_encode(['type' => 'Polygon', 'coordinates' => [[
            [$minLng, $minLat], [$maxLng, $minLat], [$maxLng, $maxLat], [$minLng, $maxLat], [$minLng, $minLat],
        ]]]);

        $stops = DB::table('stops')
            ->select('id', 'name_ar', 'city_id', DB::raw('ST_AsGeoJSON(geometry) as geojson'))
            ->whereRaw('MBRContains(ST_GeomFromGeoJSON(?), geometry)', [$boxJson])
            ->whereRaw('ST_Distance_Sphere(geometry, ST_GeomFromGeoJSON(?)) <= ?', [$pointJson, $radius])
            ->get();

        // Batch load routes for all nearby stops — one query instead of one per stop
        $stopIds = $stops->pluck('id');
        $routesByStop = DB::table('route_stop')
            ->join('routes', 'route_stop.route_id', '=', 'routes.id')
            ->whereIn('route_stop.stop_id', $stopIds)
            ->where('routes.status', 'published')
            ->select('route_stop.stop_id', 'routes.id', 'routes.name_ar')
            ->get()
            ->groupBy('stop_id');

        return response()->json($stops->map(function ($s) use ($routesByStop) {
            return [
                'id' => $s->id,
                'nameAr' => $s->name_ar,
                'cityId' => $s->city_id,
                'coordinates' => json_decode($s->geojson, true)['coordinates'],
                'routes' => $routesByStop->get($s->id, collect())->map(fn ($r) => [
                    'id' => $r->id,
                    'name_ar' => $r->name_ar,
                ])->values(),
            ];
        }));
    }

    public function search(Request $request)
    {
        $query = $request->input('q');
        if (empty($query)) {
            return response()->json(['routes' => [], 'stops' => []]);
        }

        $cityId = $request->input('city_id');
        $cityIds = is_string($cityId) && $cityId !== '' ? City::mapGroup($cityId) : null;

        // Plain indexed-table queries with a cap. This used to go through
        // Scout, whose default `collection` engine loads every route and every
        // stop (geometry included) into PHP and filters there, on each
        // keystroke, with no limit on what comes back. The columns matched are
        // the same ones the models expose to Scout.
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], (string) $query).'%';
        $matching = fn (array $columns) => function ($q) use ($columns, $like) {
            foreach ($columns as $column) {
                $q->orWhere($column, 'like', $like);
            }
        };

        $routes = Route::query()
            ->where($matching(['id', 'name_ar', 'name_en', 'city_id']))
            ->when($cityIds, fn ($q) => $q->whereIn('city_id', $cityIds))
            ->orderBy('name_ar')
            ->limit(self::SEARCH_LIMIT)
            ->get(['id', 'name_ar', 'name_en', 'city_id'])
            ->map(function ($route) {
                return [
                    'type' => 'route',
                    'id' => $route->id,
                    'nameAr' => $route->name_ar,
                    'nameEn' => $route->name_en,
                    'cityId' => $route->city_id,
                ];
            });

        $stopResults = Stop::query()
            ->where($matching(['id', 'name_ar', 'city_id']))
            ->when($cityIds, fn ($q) => $q->whereIn('city_id', $cityIds))
            ->orderBy('name_ar')
            ->limit(self::SEARCH_LIMIT)
            ->get(['id', 'name_ar', 'city_id']);

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
