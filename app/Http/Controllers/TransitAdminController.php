<?php

namespace App\Http\Controllers;

use App\Exceptions\Transit\TransitActionException;
use App\Http\Controllers\Concerns\ChecksTransitScope;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Services\Transit\TransitAdminService;
use App\Services\Transit\TransitRouteComposer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * HTTP adapter for transit moderation.
 *
 * Writes delegate to TransitAdminService, which is also what the agent MCP
 * tools call. This class keeps the scope checks (they need a Request), the
 * per-route validation, and the exact status codes the dashboard already
 * depends on.
 *
 * combineRoutes() and splitRoute() are still inline. They are the only two
 * operations not shared with the agent surface, and deliberately so: both do
 * coordinate-level surgery on route geometry, neither has any test coverage
 * (the spatial SQL needs MySQL, not the SQLite test database), and both rewrite
 * multiple live routes in one transaction. They should move behind
 * TransitAdminService only once they are covered.
 */
class TransitAdminController extends Controller
{
    use ChecksTransitScope;

    public function __construct(
        private readonly TransitAdminService $transit,
        private readonly TransitRouteComposer $composer,
    ) {}

    public function index(Request $request): SymfonyResponse
    {
        return response()->json($this->transit->drafts($this->allowedTransitCities($request)));
    }

    public function approve(Request $request, $id): SymfonyResponse
    {
        $validated = $request->validate([
            'color_index' => 'nullable|integer|min:0',
        ]);

        $draft = RouteDraft::with('linkedRoute')->findOrFail($id);

        $this->ensureTransitCityAccess($request, $draft->city_id, ['transit.approve']);

        if ($draft->route_id) {
            $linkedCityId = Route::whereKey($draft->route_id)->value('city_id');
            $this->ensureTransitCityAccess($request, $linkedCityId, ['transit.approve']);
        }

        try {
            $route = $this->transit->approveDraft(
                $draft,
                $validated['color_index'] ?? null,
                $request->user()?->getAuthIdentifier(),
            );
        } catch (TransitActionException $e) {
            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to approve draft',
                'error' => $e->getMessage(),
            ], 500);
        }

        $message = $draft->route_id ? 'Draft approved and route updated' : 'Draft approved';

        return response()->json(['message' => $message, 'route' => $route]);
    }

    public function reject(Request $request, $id): SymfonyResponse
    {
        $validated = $request->validate(['reason' => 'nullable|string|max:1000']);

        $draft = RouteDraft::findOrFail($id);

        $this->ensureTransitCityAccess($request, $draft->city_id, ['transit.reject']);

        if ($draft->route_id) {
            $linkedCityId = Route::whereKey($draft->route_id)->value('city_id');
            $this->ensureTransitCityAccess($request, $linkedCityId, ['transit.reject']);
        }

        try {
            $this->transit->rejectDraft(
                $draft,
                $validated['reason'] ?? null,
                $request->user()?->getAuthIdentifier(),
            );
        } catch (TransitActionException $e) {
            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        }

        return response()->json(['message' => 'Draft rejected']);
    }

    public function getPublishedRoutes(Request $request): SymfonyResponse
    {
        return response()->json($this->transit->routes($this->allowedTransitCities($request)));
    }

    public function getLogs(Request $request): SymfonyResponse
    {
        return response()->json($this->transit->logs($this->allowedTransitCities($request)));
    }

    public function updateRouteStatus(Request $request, $id): SymfonyResponse
    {
        $validated = $request->validate([
            'status' => 'required|string|in:published,disapproved,hidden',
        ]);

        $route = Route::findOrFail($id);

        $this->ensureTransitCityAccess($request, $route->city_id, ['transit.edit_routes']);

        try {
            $updated = $this->transit->setRouteStatus(
                $route,
                $validated['status'],
                $request->user()?->getAuthIdentifier(),
            );
        } catch (TransitActionException $e) {
            // "Already <status>" has always answered 200 here, unlike the other
            // refusals. The admin form treats it as a no-op success, so it is
            // preserved rather than normalised.
            if ($e->kind === TransitActionException::STATUS_UNCHANGED) {
                return response()->json(['message' => $e->getMessage()]);
            }

            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update route status',
                'error' => $e->getMessage(),
            ], 500);
        }

        return response()->json(['message' => 'Route status updated successfully', 'route' => $updated]);
    }

    public function moveRoute(Request $request, $id): SymfonyResponse
    {
        $validated = $request->validate([
            'city_id' => 'required|string|exists:cities,id',
        ]);

        $route = Route::findOrFail($id);

        $this->ensureTransitCitiesAccess(
            $request,
            [$route->city_id, $validated['city_id']],
            ['transit.edit_routes'],
        );

        try {
            $moved = $this->transit->moveRoute(
                $route,
                $validated['city_id'],
                $request->user()?->getAuthIdentifier(),
            );
        } catch (TransitActionException $e) {
            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to move route',
                'error' => $e->getMessage(),
            ], 500);
        }

        return response()->json(['message' => 'Route moved successfully', 'route' => $moved]);
    }

    /**
     * Delete a route and its geometry/pivot rows, dropping stops that no
     * longer belong to any route. Governorate-scoped via transit.delete_routes.
     */
    public function destroy(Request $request, $id): SymfonyResponse
    {
        $route = Route::findOrFail($id);

        $this->ensureTransitCityAccess($request, $route->city_id, ['transit.delete_routes']);

        try {
            $this->transit->destroyRoute($route, $request->user()?->getAuthIdentifier());
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to delete route',
                'error' => $e->getMessage(),
            ], 500);
        }

        return response()->json(['message' => 'Route deleted']);
    }

    public function updateRoute(Request $request, $id): SymfonyResponse
    {
        $route = Route::findOrFail($id);

        // Guard before validation here, as the original did: an out-of-scope
        // caller learns nothing about the payload.
        $this->ensureTransitCityAccess($request, $route->city_id, ['transit.edit_routes']);

        $validated = $request->validate([
            'name_ar' => 'sometimes|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'color_index' => 'nullable|integer|min:0',
            'price_new' => 'nullable|integer',
            'price_old' => 'nullable|integer',
        ]);

        $updateData = array_intersect_key($validated, array_flip([
            'name_ar', 'name_en', 'color_index', 'price_new', 'price_old',
        ]));

        // $request->has() semantics: an explicit null is a real instruction to
        // clear the column, so only wholly-absent keys are dropped.
        foreach (['name_ar', 'name_en', 'color_index', 'price_new', 'price_old'] as $field) {
            if (! $request->has($field)) {
                unset($updateData[$field]);
            }
        }

        if ($updateData === []) {
            return response()->json(['message' => 'No fields to update'], 400);
        }

        if (isset($updateData['color_index'])) {
            $updateData['color_index'] = (int) $updateData['color_index'];
        }

        $updated = $this->transit->updateRoute(
            $route,
            $updateData,
            $request->user()?->getAuthIdentifier(),
        );

        return response()->json(['message' => 'Route updated', 'route' => $updated->fresh()]);
    }

    /**
     * Combine two routes into a new one. Still dashboard-only; see the class
     * docblock.
     */
    public function combineRoutes(Request $request): SymfonyResponse
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

        $this->ensureTransitCitiesAccess($request, [$routeA->city_id, $routeB->city_id], ['transit.edit_routes']);

        try {
            $result = $this->composer->combine(
                $routeA,
                $routeB,
                $validated,
                $request->user()?->getAuthIdentifier(),
            );
        } catch (TransitActionException $e) {
            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to combine routes',
                'error' => $e->getMessage(),
            ], 500);
        }

        return response()->json(['message' => 'Routes combined successfully', 'route' => $result->route]);
    }

    /**
     * Split a route at one of its stops. Still dashboard-only; see the class
     * docblock.
     */
    public function splitRoute(Request $request): SymfonyResponse
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

        $this->ensureTransitCityAccess($request, $route->city_id, ['transit.edit_routes']);

        try {
            $result = $this->composer->split(
                $route,
                $validated['split_stop_id'],
                $validated,
                $request->user()?->getAuthIdentifier(),
            );
        } catch (TransitActionException $e) {
            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to split route',
                'error' => $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'message' => 'Route split successfully',
            'route_a' => $result->routeA,
            'route_b' => $result->routeB,
        ]);
    }

    public function getRouteStops(Request $request, $id): SymfonyResponse
    {
        $route = Route::findOrFail($id);

        $this->ensureTransitCityAccess($request, $route->city_id, ['transit.review_drafts']);

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

    public function getRouteGeoJson(Request $request, $id): SymfonyResponse
    {
        $route = Route::findOrFail($id);

        $this->ensureTransitCityAccess($request, $route->city_id, ['transit.review_drafts']);

        $geomJson = DB::table('route_geometries')->selectRaw('ST_AsGeoJSON(geometry) as geojson')->where('route_id', $route->id)->value('geojson');

        $features = [];
        if ($geomJson) {
            $features[] = [
                'type' => 'Feature',
                'geometry' => json_decode($geomJson, true),
                'properties' => [
                    'id' => $route->id,
                    'nameAr' => $route->name_ar,
                    'nameEn' => $route->name_en,
                    'colorIndex' => (int) ($route->color_index ?? 0),
                    'color_index' => (int) ($route->color_index ?? 0),
                    'priceOld' => $route->price_old,
                    'priceNew' => $route->price_new,
                ],
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
                    ],
                ];
            }
        }

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
        ]);
    }
}
