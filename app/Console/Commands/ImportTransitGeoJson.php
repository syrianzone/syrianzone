<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\City;
use App\Models\Route;
use App\Models\RouteGeometry;
use App\Models\Stop;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class ImportTransitGeoJson extends Command
{
    protected $signature = 'transit:import-geojson';
    protected $description = 'Import transit data from GeoJSON files';

    public function handle()
    {
        $this->info('Importing cities...');
        $citiesPath = resource_path('js/Pages/Transit/_data/cities.json');

        if (!File::exists($citiesPath)) {
            $this->error("cities.json not found at {$citiesPath}");
            return;
        }

        $cities = json_decode(File::get($citiesPath), true);
        
        // Disable foreign key checks for truncation
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('route_stop')->truncate();
        RouteGeometry::truncate();
        Stop::truncate();
        Route::truncate();
        City::truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        foreach ($cities as $cityData) {
            $bounds = $cityData['bounds'];
            // Create Polygon WKT: POLGYON((minLng minLat, maxLng minLat, maxLng maxLat, minLng maxLat, minLng minLat))
            $minLng = $bounds[0][0];
            $minLat = $bounds[0][1];
            $maxLng = $bounds[1][0];
            $maxLat = $bounds[1][1];
            
            $polygonWkt = "POLYGON(($minLng $minLat, $maxLng $minLat, $maxLng $maxLat, $minLng $maxLat, $minLng $minLat))";
            $centerWkt = "POINT({$cityData['center'][0]} {$cityData['center'][1]})";

            DB::statement(
                'INSERT INTO cities (id, name_ar, name_en, center, bounds, zoom, status, created_at, updated_at) '
                . 'VALUES (?, ?, ?, ST_GeomFromText(?), ST_GeomFromText(?), ?, ?, ?, ?)',
                [
                    $cityData['id'], $cityData['nameAr'], $cityData['nameEn'],
                    $centerWkt, $polygonWkt, $cityData['zoom'], $cityData['status'],
                    now(), now(),
                ]
            );

            $this->importRoutes($cityData['id']);
            $this->importStops($cityData['id']);
        }
        
        $this->info('Done importing.');
    }

    private function importRoutes($cityId)
    {
        $path = public_path("data/{$cityId}/routes.geojson");
        if (!File::exists($path)) return;
        
        $data = json_decode(File::get($path), true);
        if (empty($data['features'])) return;

        foreach ($data['features'] as $feature) {
            $props = $feature['properties'];
            $geom = $feature['geometry'];
            
            $route = Route::create([
                'id' => $props['id'],
                'city_id' => $cityId,
                'name_ar' => $props['nameAr'] ?? '',
                'name_en' => $props['nameEn'] ?? null,
                'color_index' => $props['colorIndex'] ?? 0,
                'price_old' => $props['priceOld'] ?? null,
                'price_new' => $props['priceNew'] ?? null,
                'status' => 'published',
            ]);

            DB::statement(
                'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
                [$route->id, json_encode($geom), now(), now()]
            );
        }
    }

    private function importStops($cityId)
    {
        $path = public_path("data/{$cityId}/stops.geojson");
        if (!File::exists($path)) return;
        
        $data = json_decode(File::get($path), true);
        if (empty($data['features'])) return;

        $orderCounts = [];

        foreach ($data['features'] as $feature) {
            $props = $feature['properties'];
            $geom = $feature['geometry'];
            
            $stopId = $props['id'];
            
            if (!Stop::find($stopId)) {
                DB::statement(
                    'INSERT INTO stops (id, city_id, name_ar, geometry, created_at, updated_at) VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)',
                    [$stopId, $cityId, $props['nameAr'] ?? '', json_encode($geom), now(), now()]
                );
            }
            
            if (isset($props['routeId'])) {
                $routeId = $props['routeId'];
                // Ensure route exists
                if (!Route::find($routeId)) continue;

                if (!isset($orderCounts[$routeId])) {
                    $orderCounts[$routeId] = 0;
                }
                $orderCounts[$routeId]++;
                
                DB::table('route_stop')->insert([
                    'route_id' => $routeId,
                    'stop_id' => $stopId,
                    'order' => $orderCounts[$routeId],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
}
