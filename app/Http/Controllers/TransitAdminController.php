<?php

namespace App\Http\Controllers;

use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\RouteGeometry;
use App\Models\Stop;
use App\Services\TransitDraftGeoJson;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class TransitAdminController extends Controller
{
    public function index()
    {
        $drafts = RouteDraft::with(['user:id,name,is_banned', 'city:id,name_ar,name_en'])->orderBy('created_at', 'desc')->get();

        return response()->json($drafts);
    }

    public function approve($id)
    {
        try {
            $result = DB::transaction(function () use ($id) {
                $draft = RouteDraft::query()
                    ->with('city')
                    ->lockForUpdate()
                    ->findOrFail($id);

                if ($draft->status !== 'pending') {
                    return ['status' => $draft->status];
                }

                $geojson = TransitDraftGeoJson::validate($draft->geojson);
                $citySlug = Str::slug($draft->city->name_en ?? $draft->city->name_ar);
                $routeId = 'route-'.$citySlug.'-'.Str::uuid();
                $route = Route::create([
                    'id' => $routeId,
                    'city_id' => $draft->city_id,
                    'name_ar' => $draft->name_ar,
                    'name_en' => $draft->name_en,
                    'price_old' => null,
                    'price_new' => $draft->price,
                    'status' => 'published',
                ]);

                $features = $geojson['features'];
                $stops = [];
                $routeLine = null;

                foreach ($features as $feature) {
                    $type = $feature['geometry']['type'] ?? null;
                    if ($type === 'LineString') {
                        $routeLine = $feature['geometry'];
                    } elseif ($type === 'Point') {
                        $stops[] = $feature;
                    }
                }

                if ($routeLine) {
                    RouteGeometry::create([
                        'route_id' => $routeId,
                        'geometry' => $this->spatialValue($routeLine),
                    ]);
                }

                $order = 1;
                foreach ($stops as $stopFeature) {
                    $nameAr = trim($stopFeature['properties']['nameAr'] ?? '') ?: ('محطة '.$order);
                    $stopId = 'stop-'.$citySlug.'-'.Str::uuid();
                    Stop::create([
                        'id' => $stopId,
                        'city_id' => $draft->city_id,
                        'name_ar' => $nameAr,
                        'geometry' => $this->spatialValue($stopFeature['geometry']),
                    ]);
                    DB::table('route_stop')->insert([
                        'route_id' => $routeId,
                        'stop_id' => $stopId,
                        'order' => $order++,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                $draft->update(['status' => 'approved']);

                return [
                    'city_id' => $draft->city_id,
                    'route' => $route,
                ];
            });

            if (isset($result['status'])) {
                return response()->json(['message' => 'Draft is already '.$result['status']], 400);
            }

            Cache::forget("transit:map-data:{$result['city_id']}");
            Cache::forget('transit:cities');

            return response()->json(['message' => 'Draft approved', 'route' => $result['route']]);
        } catch (ModelNotFoundException|ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['message' => 'Failed to approve draft'], 500);
        }
    }

    public function reject(Request $request, $id)
    {
        $validated = $request->validate(['reason' => 'nullable|string|max:1000']);

        $status = DB::transaction(function () use ($id, $validated): ?string {
            $draft = RouteDraft::query()->lockForUpdate()->findOrFail($id);

            if ($draft->status !== 'pending') {
                return $draft->status;
            }

            $draft->update([
                'rejection_reason' => $validated['reason'] ?? null,
                'status' => 'rejected',
            ]);

            return null;
        });

        if ($status !== null) {
            return response()->json(['message' => 'Draft is already '.$status], 400);
        }

        return response()->json(['message' => 'Draft rejected']);
    }

    private function spatialValue(array $geometry): mixed
    {
        $json = json_encode($geometry, JSON_THROW_ON_ERROR);
        if (DB::connection()->getDriverName() === 'sqlite') {
            return $json;
        }

        $quoted = DB::connection()->getPdo()->quote($json);

        return DB::raw("ST_GeomFromGeoJSON({$quoted})");
    }
}
