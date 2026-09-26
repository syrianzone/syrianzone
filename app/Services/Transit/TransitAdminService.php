<?php

namespace App\Services\Transit;

use App\Exceptions\Transit\TransitActionException;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\TransitRouteLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Transit moderation and route administration, transport-free.
 *
 * Extracted from TransitAdminController so the dashboard and the agent MCP
 * surface cannot drift. Scope checking stays with the callers: the controller
 * has a Request and the tools have an AgentContext, and both funnel into the
 * same User::hasPermissionInCity() rule underneath.
 *
 * SCOPE OF THIS SERVICE, DELIBERATELY
 *
 *   Covered: draft approval/rejection, route status, route field updates,
 *   moving a route between governorates, deleting a route, and the three
 *   listings. These are all either spatial-free or spatial only in a narrow,
 *   well-understood step, and they are covered by the test suite.
 *
 *   Deliberately NOT covered: combineRoutes() and splitRoute(). Those remain
 *   inline in the controller for now. They are the two most destructive
 *   operations in the module — each reads route geometry, computes coordinate
 *   surgery, creates new routes, disapproves the original and rewrites stop
 *   pivots — and neither has any test coverage, because the spatial SQL cannot
 *   run on the SQLite test database. Exposing them to an autonomous caller
 *   before they are covered and verified against MySQL would risk corrupting a
 *   live governorate map. See docs/modules/agent-mcp.md.
 */
class TransitAdminService
{
    public function __construct(private readonly TransitCache $cache) {}

    /**
     * Pending and reviewed drafts, newest first.
     *
     * Bounded: the drafts table grows without limit, so a bare ->get() would
     * eventually take down the listing.
     *
     * @param  array<int, string>|null  $allowedCities  Null means unrestricted.
     * @return Collection<int, RouteDraft>
     */
    public function drafts(?array $allowedCities = null, int $limit = 500)
    {
        return RouteDraft::with(['user:id,name', 'city:id,name_ar,name_en', 'linkedRoute:id,name_ar,name_en'])
            ->when($allowedCities !== null, fn ($q) => $q->whereIn('city_id', $allowedCities))
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * @param  array<int, string>|null  $allowedCities
     * @return Collection<int, Route>
     */
    public function routes(?array $allowedCities = null)
    {
        return Route::with(['city:id,name_ar,name_en'])
            ->withCount('stops')
            ->when($allowedCities !== null, fn ($q) => $q->whereIn('city_id', $allowedCities))
            ->get();
    }

    /**
     * @param  array<int, string>|null  $allowedCities
     * @return Collection<int, TransitRouteLog>
     */
    public function logs(?array $allowedCities = null, int $limit = 200)
    {
        return TransitRouteLog::with(['user:id,name'])
            ->when($allowedCities !== null, fn ($q) => $q->whereHas(
                'route',
                fn ($r) => $r->whereIn('city_id', $allowedCities)
            ))
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    public function findDraft(int $id): RouteDraft
    {
        return RouteDraft::with(['city:id,name_ar,name_en', 'user:id,name'])->findOrFail($id);
    }

    public function findRoute(string $id): Route
    {
        return Route::with('city:id,name_ar,name_en')->findOrFail($id);
    }

    /**
     * Approve a draft.
     *
     * Two shapes:
     *  - Linked (draft->route_id set): an edit suggestion for a live route.
     *    The route's metadata, geometry and stops are replaced, and the route is
     *    republished.
     *  - Original: a brand new route is created from the draft's geometry.
     *
     * A contributor's colour survives when the reviewer does not re-pick one.
     *
     * @throws TransitActionException when the draft is no longer pending
     */
    public function approveDraft(RouteDraft $draft, ?int $colorIndex, ?int $actorId): Route
    {
        if ($draft->status !== 'pending') {
            throw TransitActionException::draftNotPending($draft->status, (int) $draft->id);
        }

        $resolvedColor = $colorIndex ?? $draft->color_index;

        return $draft->route_id
            ? $this->approveLinkedDraft($draft, $resolvedColor, $actorId)
            : $this->approveNewDraft($draft, $resolvedColor, $actorId);
    }

    /**
     * An edit to a route that is already live.
     *
     * TransitStudioController::unpublishLinkedRoute() takes the route off the
     * public map (status 'disapproved') the moment such a draft is submitted, so
     * the live map never shows stale data while the edit is in review. That
     * means the route is 'disapproved' by the time an admin opens the draft, and
     * approving has to put it back — otherwise accepting an edit would leave the
     * route permanently offline. rejectDraft() does the same restoration; both
     * paths must, or the route vanishes depending only on which button was hit.
     */
    protected function approveLinkedDraft(RouteDraft $draft, ?int $colorIndex, ?int $actorId): Route
    {
        return DB::transaction(function () use ($draft, $colorIndex, $actorId) {
            $route = Route::findOrFail($draft->route_id);

            $route->name_ar = $draft->name_ar;
            $route->name_en = $draft->name_en;
            $route->price_new = $draft->price;

            if ($colorIndex !== null) {
                $route->color_index = (int) $colorIndex;
            }

            // Republish: the submitter took it offline, and this is the moment
            // the reviewed data is allowed to go live.
            $route->status = 'published';
            $route->save();

            $this->replaceGeometryFromDraft($route, $draft);
            $this->replaceStopsFromDraft($route, $draft);

            TransitRouteLog::create([
                'route_id' => $route->id,
                'action' => 'updated_via_draft',
                'description' => "تحديث الخط '{$route->name_ar}' بناءً على مساهمة #{$draft->id} من ".($draft->user->name ?? 'مجهول'),
                'user_id' => $actorId,
            ]);

            $draft->status = 'approved';
            $draft->save();

            $this->cache->forgetCity($draft->city_id);

            return $route;
        });
    }

    /**
     * A new route built from scratch out of the draft's GeoJSON.
     */
    protected function approveNewDraft(RouteDraft $draft, ?int $colorIndex, ?int $actorId): Route
    {
        return DB::transaction(function () use ($draft, $colorIndex) {
            $routeId = 'route-'.Str::slug($draft->city->name_en ?? $draft->city->name_ar).'-'.Str::uuid();

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

            $this->replaceGeometryFromDraft($route, $draft);
            $this->replaceStopsFromDraft($route, $draft);

            $draft->status = 'approved';
            $draft->save();

            $this->cache->forgetCity($draft->city_id);

            return $route;
        });
    }

    /**
     * Reject a draft, recording the reviewer's reason.
     *
     * A rejected linked-edit restores the route the submitter un-published, for
     * the same reason approveLinkedDraft() republishes it: the withdrawal was
     * temporary and the review is now over.
     *
     * @throws TransitActionException when the draft is no longer pending
     */
    public function rejectDraft(RouteDraft $draft, ?string $reason, ?int $actorId): RouteDraft
    {
        if ($draft->status !== 'pending') {
            throw TransitActionException::draftNotPending($draft->status, (int) $draft->id);
        }

        return DB::transaction(function () use ($draft, $reason, $actorId) {
            $draft->status = 'rejected';
            $draft->rejection_reason = $reason;
            $draft->save();

            if ($draft->route_id) {
                $this->restoreLinkedRoute($draft, $actorId);
            }

            return $draft;
        });
    }

    /**
     * Put a withdrawn route back on the map after its edit was rejected.
     */
    protected function restoreLinkedRoute(RouteDraft $draft, ?int $actorId): void
    {
        $route = Route::find($draft->route_id);

        if ($route === null || $route->status !== 'disapproved') {
            return;
        }

        $route->status = 'published';
        $route->save();

        TransitRouteLog::create([
            'route_id' => $route->id,
            'action' => 'restored_after_reject',
            'description' => "إعادة نشر الخط '{$route->name_ar}' بعد رفض التعديلات (مساهمة #{$draft->id})",
            'user_id' => $actorId,
        ]);

        $this->cache->forgetCity($route->city_id);
    }

    /**
     * @param  'published'|'disapproved'|'hidden'  $status
     *
     * @throws TransitActionException when the route already has that status
     */
    public function setRouteStatus(Route $route, string $status, ?int $actorId): Route
    {
        $oldStatus = $route->status;

        if ($oldStatus === $status) {
            throw TransitActionException::statusUnchanged($status, (string) $route->id);
        }

        return DB::transaction(function () use ($route, $status, $oldStatus, $actorId) {
            $route->status = $status;
            $route->save();

            TransitRouteLog::create([
                'route_id' => $route->id,
                'action' => $this->statusAction($status),
                'description' => $this->statusDescription($route, $oldStatus, $status),
                'user_id' => $actorId,
            ]);

            $this->cache->forgetCity($route->city_id);

            return $route;
        });
    }

    /**
     * Update the admin-editable fields of a route. Fields not present in
     * $data are left alone.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws TransitActionException when $data carries nothing recognisable
     */
    public function updateRoute(Route $route, array $data, ?int $actorId): Route
    {
        $fields = array_intersect_key($data, array_flip([
            'name_ar', 'name_en', 'color_index', 'price_new', 'price_old',
        ]));

        if ($fields === []) {
            throw TransitActionException::noChanges();
        }

        $oldNameAr = $route->name_ar;
        $route->fill($fields);
        $route->save();

        $this->logAdminEdit($route, $fields, $oldNameAr, $actorId);

        $this->cache->forgetCity($route->city_id);

        return $route;
    }

    /**
     * Move a route to another governorate, carrying its stops along.
     *
     * A stop that belongs to no other route is simply re-pointed at the new
     * governorate. A stop still shared with a route left behind has to be
     * copied, because the other route's copy must keep its original city. This
     * is the one spatial read in this service.
     *
     * @throws TransitActionException when the route is already in that city
     */
    public function moveRoute(Route $route, string $targetCityId, ?int $actorId): Route
    {
        $oldCityId = $route->city_id;

        if ($oldCityId === $targetCityId) {
            throw TransitActionException::sameCity($oldCityId, (string) $route->id);
        }

        $oldCityName = $this->cityName($oldCityId);
        $newCityName = $this->cityName($targetCityId);

        return DB::transaction(function () use ($route, $targetCityId, $oldCityId, $oldCityName, $newCityName, $actorId) {
            $stops = $route->stops()->orderBy('pivot_order')->get();

            foreach ($stops as $stop) {
                $sharedWithOthers = DB::table('route_stop')
                    ->join('routes', 'route_stop.route_id', '=', 'routes.id')
                    ->where('route_stop.stop_id', $stop->id)
                    ->where('route_stop.route_id', '!=', $route->id)
                    ->where('routes.city_id', $oldCityId)
                    ->exists();

                if (! $sharedWithOthers) {
                    $stop->city_id = $targetCityId;
                    $stop->save();

                    continue;
                }

                $newStopId = 'stop-'.Str::slug($targetCityId).'-'.Str::uuid();

                $geometry = DB::table('stops')
                    ->selectRaw('ST_AsGeoJSON(geometry) as geojson')
                    ->where('id', $stop->id)
                    ->value('geojson');

                DB::statement(
                    'INSERT INTO stops (id, city_id, name_ar, geometry, created_at, updated_at) VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)',
                    [$newStopId, $targetCityId, $stop->name_ar, $geometry, now(), now()]
                );

                DB::table('route_stop')
                    ->where('route_id', $route->id)
                    ->where('stop_id', $stop->id)
                    ->update(['stop_id' => $newStopId, 'updated_at' => now()]);
            }

            $route->city_id = $targetCityId;
            $route->save();

            TransitRouteLog::create([
                'route_id' => $route->id,
                'action' => 'moved',
                'description' => "نقل الخط '{$route->name_ar}' من مدينة '{$oldCityName}' إلى مدينة '{$newCityName}'",
                'user_id' => $actorId,
            ]);

            $this->cache->forgetCities($oldCityId, $targetCityId);

            return $route;
        });
    }

    /**
     * Delete a route, its geometry and its pivot rows, plus any stop left
     * belonging to no route at all.
     *
     * @return int Number of orphaned stops removed.
     */
    public function destroyRoute(Route $route, ?int $actorId): int
    {
        $cityId = $route->city_id;
        $nameAr = $route->name_ar;

        $stopIds = DB::table('route_stop')->where('route_id', $route->id)->pluck('stop_id')->all();

        return DB::transaction(function () use ($route, $stopIds, $cityId, $nameAr, $actorId) {
            DB::table('route_stop')->where('route_id', $route->id)->delete();
            DB::table('route_geometries')->where('route_id', $route->id)->delete();
            $route->delete();

            $orphansRemoved = $this->pruneOrphanStops($stopIds);

            TransitRouteLog::create([
                'route_id' => $route->id,
                'action' => 'deleted',
                'description' => "حذف الخط '{$nameAr}'",
                'user_id' => $actorId,
            ]);

            $this->cache->forgetCity($cityId);

            return $orphansRemoved;
        });
    }

    /**
     * Drop stops that no longer appear in any route_stop row.
     *
     * @param  array<int, string>  $stopIds
     */
    protected function pruneOrphanStops(array $stopIds): int
    {
        if ($stopIds === []) {
            return 0;
        }

        $stillUsed = DB::table('route_stop')->whereIn('stop_id', $stopIds)->pluck('stop_id')->all();
        $orphans = array_values(array_diff($stopIds, $stillUsed));

        if ($orphans === []) {
            return 0;
        }

        return DB::table('stops')->whereIn('id', $orphans)->delete();
    }

    /**
     * Replace a route's single geometry row with the line carried by the draft.
     * A draft with no line feature leaves the route with no geometry, which is
     * what the reviewer would see in the editor.
     */
    protected function replaceGeometryFromDraft(Route $route, RouteDraft $draft): void
    {
        [$line] = $this->splitDraftFeatures($draft->geojson ?? []);

        DB::table('route_geometries')->where('route_id', $route->id)->delete();

        if ($line === null) {
            return;
        }

        DB::statement(
            'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
            [$route->id, json_encode($line), now(), now()]
        );
    }

    /**
     * Replace a route's stops with the points carried by the draft, and remove
     * the previous stops that nothing else references any more.
     */
    protected function replaceStopsFromDraft(Route $route, RouteDraft $draft): void
    {
        [, $stopFeatures] = $this->splitDraftFeatures($draft->geojson ?? []);

        $previousStopIds = DB::table('route_stop')->where('route_id', $route->id)->pluck('stop_id')->all();

        DB::table('route_stop')->where('route_id', $route->id)->delete();

        $order = 1;
        $citySlug = Str::slug($draft->city->name_en ?? $draft->city->name_ar);

        foreach ($stopFeatures as $stopFeature) {
            $nameAr = trim($stopFeature['properties']['nameAr'] ?? '') ?: ('محطة '.$order);
            $stopId = 'stop-'.$citySlug.'-'.Str::uuid();

            DB::statement(
                'INSERT INTO stops (id, city_id, name_ar, geometry, created_at, updated_at) VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)',
                [$stopId, $draft->city_id, $nameAr, json_encode($stopFeature['geometry']), now(), now()]
            );

            DB::table('route_stop')->insert([
                'route_id' => $route->id,
                'stop_id' => $stopId,
                'order' => $order++,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->pruneOrphanStops($previousStopIds);
    }

    /**
     * Split a draft's GeoJSON feature collection into its line geometry and its
     * point features.
     *
     * @param  array<string, mixed>  $geojson
     * @return array{0: array<string, mixed>|null, 1: array<int, array<string, mixed>>}
     */
    protected function splitDraftFeatures(array $geojson): array
    {
        $line = null;
        $stops = [];

        foreach ($geojson['features'] ?? [] as $feature) {
            if (! is_array($feature)) {
                continue;
            }

            $type = $feature['geometry']['type'] ?? null;

            if ($type === 'LineString' || $type === 'MultiLineString') {
                $line = $feature['geometry'];
            } elseif ($type === 'Point') {
                $stops[] = $feature;
            }
        }

        return [$line, $stops];
    }

    protected function cityName(string $cityId): string
    {
        return DB::table('cities')->where('id', $cityId)->value('name_ar') ?? $cityId;
    }

    protected function statusAction(string $status): string
    {
        return match ($status) {
            'published' => 'restored',
            'disapproved' => 'disapproved',
            'hidden' => 'hidden',
            default => 'updated_status',
        };
    }

    protected function statusDescription(Route $route, string $oldStatus, string $newStatus): string
    {
        $labels = [
            'published' => 'منشور',
            'disapproved' => 'ملغى (مرفوض)',
            'hidden' => 'مخفي',
        ];

        return sprintf(
            "تغيير حالة الخط '%s' من '%s' إلى '%s'",
            $route->name_ar,
            $labels[$oldStatus] ?? $oldStatus,
            $labels[$newStatus] ?? $newStatus,
        );
    }

    /**
     * The audit-log write for a direct field edit is best-effort: losing a log
     * line must not fail an edit that already committed, and the controller has
     * always behaved this way.
     *
     * @param  array<string, mixed>  $fields
     */
    protected function logAdminEdit(Route $route, array $fields, ?string $oldNameAr, ?int $actorId): void
    {
        $changes = [];

        if (array_key_exists('name_ar', $fields)) {
            $changes[] = "الاسم من '{$oldNameAr}' إلى '{$fields['name_ar']}'";
        }
        if (array_key_exists('name_en', $fields)) {
            $changes[] = 'الاسم الإنجليزي';
        }
        if (array_key_exists('color_index', $fields)) {
            $changes[] = 'لون المسار';
        }
        if (array_key_exists('price_new', $fields)) {
            $changes[] = "التعرفة إلى '{$fields['price_new']}'";
        }

        try {
            TransitRouteLog::create([
                'route_id' => (string) $route->id,
                'action' => 'admin_updated',
                'description' => "تعديل مباشر للخط '{$route->name_ar}': ".($changes === [] ? 'تحديث البيانات' : implode(', ', $changes)),
                'user_id' => $actorId,
            ]);
        } catch (\Exception $e) {
            report($e);
        }
    }

    /**
     * Resolve the reviewing actor's user id, for callers that only hold a name.
     */
    public function actorId(?User $user): ?int
    {
        return $user?->getAuthIdentifier();
    }
}
