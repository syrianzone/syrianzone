<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\City;
use App\Models\Route;
use App\Models\Stop;
use App\Services\Transit\PublishedRoutes;
use App\Services\Transit\TransitCache;
use App\Services\Transit\TransitCities;
use App\Services\Transit\TransitPresenter;
use App\Support\ArabicSearch;
use App\Support\Facts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class TransitController extends Controller
{
    /** Most results one search returns per kind (routes, stops). */
    private const SEARCH_LIMIT = 50;

    public function __construct(
        private readonly TransitCache $cache,
        private readonly TransitPresenter $presenter,
    ) {}

    public function getCities(TransitCities $cities)
    {
        return response()->json($cities->forApi());
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

    public function getRoutes($id, PublishedRoutes $routes)
    {
        $this->cityIdsFor($id);

        return response()->json($routes->forCity($id));
    }

    public function getMapData($id)
    {
        $cityIds = $this->cityIdsFor($id);
        $data = Cache::remember($this->cache->mapDataKey($id), 600, function () use ($cityIds) {
            $routeGeometries = DB::table('route_geometries')
                ->join('routes', 'route_geometries.route_id', '=', 'routes.id')
                ->whereIn('routes.city_id', $cityIds)
                ->where('routes.status', 'published')
                ->select('routes.*', DB::raw('ST_AsGeoJSON(route_geometries.geometry) as geojson'))
                ->get();

            $routeFeatures = $routeGeometries->map(fn ($r) => $this->presenter->routeFeature(
                $r,
                json_decode($r->geojson, true),
            ));

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
                ->map(fn ($rows) => $rows->pluck('route_id')->values()->all());

            $stopFeatures = $stops->map(fn ($s) => $this->presenter->stopFeature(
                $s,
                json_decode($s->geojson, true),
                $routeMap->get($s->id, []),
            ));

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
        // the same ones the models expose to Scout, except that the Arabic
        // name is compared folded to folded (`*_fold`); ids, city ids and
        // English names keep the raw pattern.
        $raw = (string) $query;
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $raw).'%';
        $folded = ArabicSearch::fold($raw);
        $foldLike = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $folded === '' ? $raw : $folded).'%';

        $routes = Route::query()
            ->where(function ($q) use ($like, $foldLike) {
                $q->where('id', 'like', $like)
                    ->orWhere('name_ar_fold', 'like', $foldLike)
                    ->orWhere('name_en', 'like', $like)
                    ->orWhere('city_id', 'like', $like);
            })
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
            ->where(function ($q) use ($like, $foldLike) {
                $q->where('id', 'like', $like)
                    ->orWhere('name_ar_fold', 'like', $foldLike)
                    ->orWhere('city_id', 'like', $like);
            })
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
