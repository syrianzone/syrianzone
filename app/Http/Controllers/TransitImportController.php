<?php

namespace App\Http\Controllers;

use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\TransitRouteLog;
use App\Services\TransitKmlImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TransitImportController extends Controller
{
    /**
     * Preview a Google My Maps share (or uploaded KML/KMZ/GeoJSON) without
     * writing anything. Returns 1..N route candidates for the admin to
     * review, edit, then publish one by one.
     */
    public function preview(Request $request, TransitKmlImportService $importer)
    {
        $validated = $request->validate([
            'url' => 'nullable|string|max:2048',
            'mid' => 'nullable|string|max:128',
            'city_id' => 'nullable|string|exists:cities,id',
            'file' => 'nullable|file|max:5120',
        ]);

        $hasUrl = ! empty($validated['url']);
        $hasMid = ! empty($validated['mid']);
        $hasFile = $request->hasFile('file');

        if (! $hasUrl && ! $hasMid && ! $hasFile) {
            return response()->json([
                'message' => 'الصق رابط خريطة Google My Maps أو ارفع ملف KML/KMZ/GeoJSON',
            ], 422);
        }

        try {
            if ($hasFile) {
                $candidates = $importer->parseUploadedFile($request->file('file'));
                $mid = $importer->extractMid($validated['url'] ?? $validated['mid'] ?? '');
            } else {
                $mid = $importer->extractMid($validated['url'] ?? $validated['mid'] ?? '');
                if ($mid === null) {
                    return response()->json([
                        'message' => 'رابط غير صالح — انسخ رابط My Maps الذي يحتوي mid= (مثال: google.com/maps/d/...?mid=...)',
                    ], 422);
                }

                $cacheKey = 'transit:import:'.$mid;
                $kml = Cache::remember($cacheKey, 3600, fn () => $importer->fetchKmlByMid($mid));
                $candidates = $importer->parseKml($kml);
            }
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $override = $validated['city_id'] ?? null;
        foreach ($candidates as &$c) {
            $c['suggested_city_id'] = $override ?? $this->suggestCityForBounds($c['bounds']);
        }
        unset($c);

        return response()->json([
            'mid' => $mid ?? null,
            'routes' => $candidates,
        ]);
    }

    /**
     * Publish one reviewed candidate. Default mode creates a pending
     * RouteDraft so the existing approve flow (audit log, spatial
     * transaction, cache bust) stays the single publish path. `mode=direct`
     * publishes immediately for trusted bulk work.
     */
    public function publish(Request $request)
    {
        $validated = $request->validate([
            'city_id' => 'required|string|exists:cities,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'price' => 'nullable|integer|min:0|max:1000000',
            'color_index' => 'nullable|integer|min:0|max:20',
            'notes' => 'nullable|string|max:5000',
            'geojson' => 'required|array',
            'geojson.features' => 'required|array|min:1|max:500',
            'geojson.features.*.geometry' => 'required|array',
            'geojson.features.*.geometry.type' => 'required|string|in:LineString,MultiLineString,Point',
            'geojson.features.*.geometry.coordinates' => 'required|array|min:1',
            'mode' => 'nullable|string|in:draft,direct',
            'source_mid' => 'nullable|string|max:128',
        ]);

        $geojson = $request->input('geojson');
        $check = $this->validateGeoJsonGeometry($geojson);
        if ($check !== null) {
            return response()->json(['message' => $check], 422);
        }

        $notes = $validated['notes'] ?? null;
        if (! empty($validated['source_mid']) && $notes !== null && ! str_contains($notes, $validated['source_mid'])) {
            $notes .= "\n\nمستورد من Google My Maps (mid: {$validated['source_mid']})";
        } elseif (! empty($validated['source_mid']) && $notes === null) {
            $notes = "مستورد من Google My Maps (mid: {$validated['source_mid']})";
        }

        $mode = $validated['mode'] ?? 'draft';

        if ($mode === 'direct') {
            return $this->publishDirect($validated, $geojson, $notes);
        }

        $draft = RouteDraft::create([
            'user_id' => auth()->id(),
            'city_id' => $validated['city_id'],
            'name_ar' => trim($validated['name_ar']),
            'name_en' => ! empty($validated['name_en']) ? trim($validated['name_en']) : null,
            'price' => $validated['price'] ?? null,
            'color_index' => $validated['color_index'] ?? 0,
            'notes' => $notes,
            'geojson' => $geojson,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'تم إنشاء المسودة — راجعها في تبويب المسودات ثم وافق للنشر',
            'draft_id' => $draft->id,
            'draft' => $draft,
        ], 201);
    }

    /**
     * Deep geometry check beyond the structural `in:` rule above: every
     * coordinate must be a finite [lng, lat] pair in range, every line must
     * have ≥2 vertices. Returns an Arabic error or null when valid.
     */
    private function validateGeoJsonGeometry(array $geojson): ?string
    {
        $vertexTotal = 0;

        foreach ($geojson['features'] ?? [] as $feature) {
            $geom = $feature['geometry'] ?? null;
            $type = $geom['type'] ?? null;
            $coords = $geom['coordinates'] ?? null;

            if (! is_array($coords)) {
                return 'إحداثيات غير صالحة في أحد المعالم';
            }

            if ($type === 'Point') {
                if ($this->cleanPair($coords) === null) {
                    return 'إحداثيات محطة غير صالحة — يجب أن تكون [خط طول, خط عرض] ضمن النطاقات';
                }

                continue;
            }

            $rings = $type === 'MultiLineString' ? $coords : [$coords];
            foreach ($rings as $ring) {
                if (! is_array($ring) || count($ring) < 2) {
                    return 'خط المسار يجب أن يحتوي نقطتين على الأقل';
                }
                foreach ($ring as $pair) {
                    if ($this->cleanPair($pair) === null) {
                        return 'إحداثيات خط غير صالحة — يجب أن تكون [خط طول, خط عرض] ضمن النطاقات';
                    }
                    $vertexTotal++;
                    if ($vertexTotal > TransitKmlImportService::MAX_VERTICES_PER_ROUTE) {
                        return 'عدد نقاط الخط كبير جداً (الحد 5000 نقطة)';
                    }
                }
            }
        }

        return null;
    }

    /** @return ?array{0:float, 1:float} */
    private function cleanPair(mixed $pair): ?array
    {
        if (! is_array($pair) || count($pair) < 2 || ! is_numeric($pair[0]) || ! is_numeric($pair[1])) {
            return null;
        }
        $lng = (float) $pair[0];
        $lat = (float) $pair[1];
        if (! is_finite($lng) || ! is_finite($lat)) {
            return null;
        }
        if ($lng < -180 || $lng > 180 || $lat < -90 || $lat > 90 || ($lng === 0.0 && $lat === 0.0)) {
            return null;
        }

        return [$lng, $lat];
    }

    /**
     * Immediate publish (trusted bulk path). Mirrors the new-route branch of
     * TransitAdminController@approve so geometry/stops/pivot/cache handling
     * stays identical.
     */
    private function publishDirect(array $validated, array $geojson, ?string $notes)
    {
        $cityName = DB::table('cities')->where('id', $validated['city_id'])->value('name_en')
            ?? DB::table('cities')->where('id', $validated['city_id'])->value('name_ar')
            ?? 'transit';

        DB::beginTransaction();
        try {
            $routeId = 'route-'.Str::slug($cityName).'-'.Str::uuid();

            $route = Route::create([
                'id' => $routeId,
                'city_id' => $validated['city_id'],
                'name_ar' => trim($validated['name_ar']),
                'name_en' => ! empty($validated['name_en']) ? trim($validated['name_en']) : null,
                'color_index' => (int) ($validated['color_index'] ?? 0),
                'price_old' => null,
                'price_new' => $validated['price'] ?? null,
                'status' => 'published',
                'user_id' => auth()->id(),
            ]);

            $routeLine = null;
            $stops = [];
            foreach ($geojson['features'] ?? [] as $feature) {
                $type = $feature['geometry']['type'] ?? null;
                if ($type === 'LineString' || $type === 'MultiLineString') {
                    // Prefer the longest line when several are present.
                    $len = $type === 'LineString'
                        ? count($feature['geometry']['coordinates'] ?? [])
                        : array_sum(array_map(fn ($r) => is_array($r) ? count($r) : 0, $feature['geometry']['coordinates'] ?? []));
                    $prevLen = $routeLine === null ? -1 : ($routeLine['_len'] ?? 0);
                    if ($len > $prevLen) {
                        $routeLine = $feature['geometry'];
                        $routeLine['_len'] = $len;
                    }
                } elseif ($type === 'Point') {
                    $stops[] = $feature;
                }
            }
            if (is_array($routeLine)) {
                unset($routeLine['_len']);
            }

            if ($routeLine) {
                DB::statement(
                    'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
                    [$routeId, json_encode($routeLine), now(), now()]
                );
            }

            $order = 1;
            foreach ($stops as $stopFeature) {
                $stopPoint = $stopFeature['geometry'];
                $nameAr = trim($stopFeature['properties']['nameAr'] ?? $stopFeature['properties']['name'] ?? '') ?: ('محطة '.$order);
                $stopId = 'stop-'.Str::slug($cityName).'-'.Str::uuid();

                DB::statement(
                    'INSERT INTO stops (id, city_id, name_ar, geometry, created_at, updated_at) VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)',
                    [$stopId, $validated['city_id'], $nameAr, json_encode($stopPoint), now(), now()]
                );

                DB::table('route_stop')->insert([
                    'route_id' => $routeId,
                    'stop_id' => $stopId,
                    'order' => $order++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            TransitRouteLog::create([
                'route_id' => $route->id,
                'action' => 'imported',
                'description' => "استيراد الخط '{$route->name_ar}' من Google My Maps".(! empty($validated['source_mid']) ? " (mid: {$validated['source_mid']})" : ''),
                'user_id' => auth()->id(),
            ]);

            DB::commit();

            $this->clearCityMapCache($validated['city_id']);

            return response()->json([
                'message' => 'تم نشر الخط المستورد',
                'route' => $route,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['message' => 'فشل نشر الخط', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Suggest a city whose bounds contain the candidate centroid. Returns
     * null when nothing contains it (admin picks manually).
     */
    private function suggestCityForBounds(?array $bounds): ?string
    {
        if (! is_array($bounds) || count($bounds) < 4) {
            return null;
        }
        [$minLng, $minLat, $maxLng, $maxLat] = $bounds;
        $centLng = ($minLng + $maxLng) / 2;
        $centLat = ($minLat + $maxLat) / 2;

        try {
            $cities = DB::table('cities')->select('id', DB::raw('ST_AsGeoJSON(bounds) as geojson'))->get();
        } catch (\Throwable) {
            // sqlite (tests) has no spatial functions: the bounds column
            // itself holds the raw GeoJSON inserted by the seeder/test.
            try {
                $cities = DB::table('cities')->select('id', 'bounds as geojson')->get();
            } catch (\Throwable) {
                return null;
            }
        }

        foreach ($cities as $city) {
            $geo = json_decode($city->geojson ?? '', true);
            $ring = $geo['coordinates'][0] ?? null;
            if (! is_array($ring) || $ring === []) {
                continue;
            }
            $lngs = array_map(fn ($c) => (float) $c[0], $ring);
            $lats = array_map(fn ($c) => (float) $c[1], $ring);
            if ($centLng >= min($lngs) && $centLng <= max($lngs) && $centLat >= min($lats) && $centLat <= max($lats)) {
                return $city->id;
            }
        }

        return null;
    }

    private function clearCityMapCache(string $cityId): void
    {
        Cache::forget("transit:map-data:{$cityId}");
        Cache::forget("transit:routes:{$cityId}");
        if ($cityId === 'damascus' || $cityId === 'rif-dimashq') {
            Cache::forget('transit:map-data:damascus');
            Cache::forget('transit:map-data:rif-dimashq');
            Cache::forget('transit:routes:damascus');
            Cache::forget('transit:routes:rif-dimashq');
            Cache::forget('transit:routes:damascus+rif-dimashq');
        }
        Cache::forget('transit:cities');
    }
}
