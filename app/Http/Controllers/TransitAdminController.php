<?php

namespace App\Http\Controllers;

use App\Exceptions\DomainActionException;
use App\Exceptions\Transit\TransitActionException;
use App\Http\Controllers\Concerns\ChecksTransitScope;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Services\Transit\TransitAdminService;
use App\Services\Transit\TransitPresenter;
use App\Services\Transit\TransitRouteComposer;
use App\Services\Transit\TransitRules;
use App\Support\Permissions\PermissionCatalogue;
use App\Support\RejectionReason;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * HTTP adapter for transit moderation.
 *
 * Writes delegate to TransitAdminService, which is also what the agent MCP
 * tools call. This class keeps the scope checks (they need a Request), the
 * per-route validation, and the exact status codes the dashboard already
 * depends on. Domain refusals (TransitActionException) are rendered into
 * standardized JSON error responses by bootstrap/app.php.
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
            'color_index' => TransitRules::colorIndex(),
        ]);

        $draft = RouteDraft::with('linkedRoute')->findOrFail($id);

        $this->ensureTransitCityAccess($request, $draft->city_id, [PermissionCatalogue::TRANSIT_APPROVE]);

        if ($draft->route_id) {
            $linkedCityId = Route::whereKey($draft->route_id)->value('city_id');
            $this->ensureTransitCityAccess($request, $linkedCityId, [PermissionCatalogue::TRANSIT_APPROVE]);
        }

        return $this->respond(
            'Failed to approve draft',
            fn () => $this->transit->approveDraft(
                $draft,
                $validated['color_index'] ?? null,
                $request->user()?->getAuthIdentifier(),
            ),
            fn (Route $approved) => response()->json([
                'message' => $draft->route_id ? 'Draft approved and route updated' : 'Draft approved',
                'route' => $approved,
            ]),
        );
    }

    public function reject(Request $request, $id): SymfonyResponse
    {
        $validated = $request->validate(['reason' => RejectionReason::rules()], RejectionReason::messages());

        $draft = RouteDraft::findOrFail($id);

        $this->ensureTransitCityAccess($request, $draft->city_id, [PermissionCatalogue::TRANSIT_REJECT]);

        if ($draft->route_id) {
            $linkedCityId = Route::whereKey($draft->route_id)->value('city_id');
            $this->ensureTransitCityAccess($request, $linkedCityId, [PermissionCatalogue::TRANSIT_REJECT]);
        }

        $this->transit->rejectDraft(
            $draft,
            $validated['reason'] ?? null,
            $request->user()?->getAuthIdentifier(),
        );

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
            'status' => 'required|string|'.TransitRules::statusRule(),
        ]);

        $route = Route::findOrFail($id);

        $this->ensureTransitCityAccess($request, $route->city_id, [PermissionCatalogue::TRANSIT_EDIT_ROUTES]);

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

            throw $e;
        } catch (\Exception $e) {
            return $this->failure('Failed to update route status', $e);
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
            [PermissionCatalogue::TRANSIT_EDIT_ROUTES],
        );

        return $this->respond(
            'Failed to move route',
            fn () => $this->transit->moveRoute(
                $route,
                $validated['city_id'],
                $request->user()?->getAuthIdentifier(),
            ),
            fn (Route $moved) => response()->json(['message' => 'Route moved successfully', 'route' => $moved]),
        );
    }

    /**
     * Delete a route and its geometry/pivot rows, dropping stops that no
     * longer belong to any route. Governorate-scoped via transit.delete_routes.
     */
    public function destroy(Request $request, $id): SymfonyResponse
    {
        $route = Route::findOrFail($id);

        $this->ensureTransitCityAccess($request, $route->city_id, [PermissionCatalogue::TRANSIT_DELETE_ROUTES]);

        return $this->respond(
            'Failed to delete route',
            fn () => $this->transit->destroyRoute($route, $request->user()?->getAuthIdentifier()),
            fn () => response()->json(['message' => 'Route deleted']),
        );
    }

    public function updateRoute(Request $request, $id): SymfonyResponse
    {
        $route = Route::findOrFail($id);

        // Guard before validation: an out-of-scope caller learns nothing about
        // the payload.
        $this->ensureTransitCityAccess($request, $route->city_id, [PermissionCatalogue::TRANSIT_EDIT_ROUTES]);

        $validated = $request->validate([
            'name_ar' => 'sometimes|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'color_index' => TransitRules::colorIndex(),
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

        $this->ensureTransitCitiesAccess($request, [$routeA->city_id, $routeB->city_id], [PermissionCatalogue::TRANSIT_EDIT_ROUTES]);

        return $this->respond(
            'Failed to combine routes',
            fn () => $this->composer->combine(
                $routeA,
                $routeB,
                $validated,
                $request->user()?->getAuthIdentifier(),
            ),
            fn ($result) => response()->json(['message' => 'Routes combined successfully', 'route' => $result->route]),
        );
    }

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

        $this->ensureTransitCityAccess($request, $route->city_id, [PermissionCatalogue::TRANSIT_EDIT_ROUTES]);

        return $this->respond(
            'Failed to split route',
            fn () => $this->composer->split(
                $route,
                $validated['split_stop_id'],
                $validated,
                $request->user()?->getAuthIdentifier(),
            ),
            fn ($result) => response()->json([
                'message' => 'Route split successfully',
                'route_a' => $result->routeA,
                'route_b' => $result->routeB,
            ]),
        );
    }

    public function getRouteStops(Request $request, $id): SymfonyResponse
    {
        $route = Route::findOrFail($id);

        $this->ensureTransitCityAccess($request, $route->city_id, [PermissionCatalogue::TRANSIT_REVIEW_DRAFTS]);

        $formatted = $route->stopPoints()->map(function ($s) {
            $coords = json_decode((string) $s->geojson, true)['coordinates'] ?? [0, 0];

            return [
                'id' => $s->id,
                'name_ar' => $s->name_ar,
                'coordinates' => $coords,
            ];
        });

        return response()->json($formatted);
    }

    public function getRouteGeoJson(Request $request, $id, TransitPresenter $presenter): SymfonyResponse
    {
        $route = Route::findOrFail($id);

        $this->ensureTransitCityAccess($request, $route->city_id, [PermissionCatalogue::TRANSIT_REVIEW_DRAFTS]);

        $geomJson = DB::table('route_geometries')->selectRaw('ST_AsGeoJSON(geometry) as geojson')->where('route_id', $route->id)->value('geojson');

        $features = [];
        if ($geomJson) {
            $features[] = $presenter->routeFeature($route, json_decode($geomJson, true));
        }

        foreach ($route->stopPoints() as $s) {
            $stopGeomJson = $s->geojson;
            if ($stopGeomJson) {
                $features[] = $presenter->stopFeature($s, json_decode($stopGeomJson, true));
            }
        }

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
        ]);
    }

    /**
     * Run a domain action, keeping the controller's two failure contracts.
     *
     * Refusals are domain answers: `bootstrap/app.php` renders them with the
     * status the exception carries, so they are rethrown untouched. An
     * unexpected failure keeps the legacy `{message, error}` envelope of
     * `failure()`, which legacy callers reading `<error>` depend on — and which
     * is why a plain catch around the whole call would swallow refusals into a
     * 500.
     *
     * @template TReturn
     *
     * @param  callable(): TReturn  $action
     * @param  callable(TReturn): SymfonyResponse  $success
     */
    private function respond(string $failureMessage, callable $action, callable $success): SymfonyResponse
    {
        try {
            $result = $action();
        } catch (DomainActionException $e) {
            throw $e;
        } catch (\Exception $e) {
            return $this->failure($failureMessage, $e);
        }

        return $success($result);
    }

    /**
     * The legacy `{message, error}` envelope for an unexpected failure.
     *
     * The shape is a released contract (mobile clients read `<message>` and
     * legacy callers read `<error>`), so it is produced in one place here.
     */
    private function failure(string $message, \Exception $e): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'error' => $e->getMessage(),
        ], 500);
    }
}
