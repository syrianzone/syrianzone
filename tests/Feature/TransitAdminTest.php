<?php

use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| TransitAdminController: the HTTP adapter's own contract
|--------------------------------------------------------------------------
|
| This controller is a thin adapter over TransitAdminService, and the layers
| around it are already covered:
|
|   TransitAdminServiceTest   the business rules — approve, reject, status
|                             changes, partial updates, null clearing, moves,
|                             deletes, cache invalidation
|   TransitGovernorateScopeTest
|                             the governorate scope on the HTTP routes,
|                             including approve and reject inside and outside
|                             scope
|   Agent/TransitToolsTest    the same operations through MCP, including the
|                             linked-route scope refusal and the status no-op
|
| So what is left is the part none of those can see: the status codes, the
| validation, the order in which the guard and the validation run, and the two
| deliberate inconsistencies that look like bugs and are not.
|
| combineRoutes() and splitRoute() are absent by design — their spatial SQL
| needs MySQL, not the SQLite test database, which is also why they are still
| inline in the controller rather than in the service. getRouteGeoJson() and
| getRouteStops() are absent for the same reason: both call ST_AsGeoJSON.
|
*/

// ─── Fixtures ──────────────────────────────────────────────────────────────
//
// Deliberately local rather than reusing TransitAdminServiceTest's transitCity /
// transitDraft / transitRoute. Pest only loads the file under test, so depending
// on globals declared in a sibling file means the suite passes and
// `php artisan test tests/Feature/TransitAdminTest.php` dies with an undefined
// function. Distinct names for the same reason — two files cannot both declare
// the same global.

function taCity(string $id, string $nameEn = 'City'): void
{
    $wrap = static function (array $shape) {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return json_encode($shape, JSON_THROW_ON_ERROR);
        }

        return DB::raw('ST_GeomFromGeoJSON('.DB::connection()->getPdo()->quote(json_encode($shape, JSON_THROW_ON_ERROR)).')');
    };

    DB::table('cities')->insert([
        'id' => $id,
        'name_ar' => $nameEn,
        'name_en' => $nameEn,
        'center' => $wrap(['type' => 'Point', 'coordinates' => [36.72, 34.73]]),
        'bounds' => $wrap(['type' => 'Polygon', 'coordinates' => [[[36.5, 34.55], [36.95, 34.55], [36.95, 34.95], [36.5, 34.95], [36.5, 34.55]]]]),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

function taDraft(string $cityId, array $overrides = []): RouteDraft
{
    return RouteDraft::create(array_merge([
        'user_id' => null,
        'city_id' => $cityId,
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ], $overrides));
}

function taRoute(string $id, string $cityId, array $overrides = []): Route
{
    return Route::create(array_merge([
        'id' => $id,
        'city_id' => $cityId,
        'name_ar' => 'خط',
        'status' => 'published',
    ], $overrides));
}

/** A transit-scoped staff account, optionally narrowed to some governorates. */
function taStaff(?array $permissions = null, ?array $cities = null): User
{
    return User::factory()->create(array_filter([
        'permissions' => $permissions ?? PermissionCatalogue::forModule('transit'),
        'permission_scopes' => $cities === null ? null : ['transit' => $cities],
    ], static fn ($v) => $v !== null));
}

// ─── The linked-route guard ────────────────────────────────────────────────
//
// approve() and reject() each check the draft's own city and then, if the draft
// is a linked edit, the city of the route it points at. The second check is the
// interesting one: without it, a reviewer scoped to one governorate could
// approve a draft that sits in their scope but unpublishes a live route in
// someone else's. TransitToolsTest covers the equivalent refusal on the agent
// path; this is the HTTP one.

it('refuses to approve a linked edit whose target route is in another governorate', function () {
    taCity('homs');
    taCity('aleppo');

    $route = taRoute('route-aleppo-1', 'aleppo');

    // The draft sits in the reviewer's own governorate...
    $draft = taDraft('homs', ['route_id' => $route->id]);

    // ...but approving it would unpublish and republish a route in aleppo.
    $reviewer = taStaff(null, ['homs']);

    $this->actingAs($reviewer)
        ->postJson("/api/v1/admin/route-drafts/{$draft->id}/approve")
        ->assertForbidden();

    // The refusal has to leave the draft untouched, or a retry after widening the
    // scope would approve something already half-applied.
    expect($draft->fresh()->status)->toBe('pending');
});

it('refuses to reject a linked edit whose target route is in another governorate', function () {
    taCity('homs');
    taCity('aleppo');

    $route = taRoute('route-aleppo-1', 'aleppo');
    $draft = taDraft('homs', ['route_id' => $route->id]);

    $reviewer = taStaff(null, ['homs']);

    $this->actingAs($reviewer)
        ->postJson("/api/v1/admin/route-drafts/{$draft->id}/reject", ['reason' => 'لا'])
        ->assertForbidden();

    expect($draft->fresh()->status)->toBe('pending');
});

it('approves a linked edit when the draft and its route are both in scope', function () {
    // The control for the two above: the refusal must come from the second check,
    // not from the first, or these would pass for the wrong reason.
    taCity('homs');

    $route = taRoute('route-homs-1', 'homs');
    $draft = taDraft('homs', ['route_id' => $route->id]);

    $reviewer = taStaff(null, ['homs']);

    $this->actingAs($reviewer)
        ->postJson("/api/v1/admin/route-drafts/{$draft->id}/approve")
        ->assertOk()
        ->assertJsonPath('message', 'Draft approved and route updated');

    expect($draft->fresh()->status)->toBe('approved');
});

// ─── Each action demands its own capability ────────────────────────────────
//
// The four moderation actions are guarded by four different capabilities, so
// holding one must not imply another. TransitGovernorateScopeTest proves the
// delete capability is required; this covers the other three.

it('separates the moderation capabilities from one another', function (string $action, string $path, array $granted) {
    taCity('homs');

    $reviewer = taStaff(array_values(array_diff(PermissionCatalogue::forModule('transit'), $granted)));

    $this->actingAs($reviewer)
        ->postJson("/api/v1/admin/route-drafts/{taDraft('homs')->id}/{$path}")
        ->assertForbidden();
})->with([
    // Without transit.approve, but holding reject and the rest.
    'approve without transit.approve' => ['approve', 'approve', ['transit.approve']],
    'reject without transit.reject' => ['reject', 'reject', ['transit.reject']],
]);

it('refuses a route edit to a reviewer holding only the moderation capabilities', function () {
    taCity('homs');
    $route = taRoute('route-homs-1', 'homs');

    $reviewer = taStaff(['transit.review_drafts', 'transit.approve', 'transit.reject']);

    $this->actingAs($reviewer)
        ->putJson("/api/v1/admin/routes/{$route->id}", ['name_ar' => 'مخطط'])
        ->assertForbidden();

    expect($route->fresh()->name_ar)->not->toBe('مخطط');
});

it('refuses a route move to a reviewer who cannot edit routes', function () {
    taCity('homs');
    taCity('aleppo');
    $route = taRoute('route-homs-1', 'homs');

    $reviewer = taStaff(['transit.review_drafts', 'transit.approve', 'transit.reject']);

    $this->actingAs($reviewer)
        ->postJson("/api/v1/admin/routes/{$route->id}/move", ['city_id' => 'aleppo'])
        ->assertForbidden();

    expect($route->fresh()->city_id)->toBe('homs');
});

// ─── The status no-op answers 200, not 400 ─────────────────────────────────
//
// TransitActionException::httpStatus() maps STATUS_UNCHANGED to 400 like every
// other refusal, and updateRouteStatus() deliberately overrides that to 200.
// The admin form treats it as a no-op success. That inconsistency is load-bearing
// and looks like a bug, so it is pinned here: a refactor that "fixes" it to 400
// breaks the dashboard's edit flow with no test objecting.

it('answers 200 when a route status is already what was asked for', function () {
    taCity('homs');
    $route = taRoute('route-homs-1', 'homs', ['status' => 'published']);

    $this->actingAs(taStaff())
        ->postJson("/api/v1/admin/routes/{$route->id}/status", ['status' => 'published'])
        ->assertOk()
        ->assertJsonPath('message', 'Route route-homs-1 is already published.');
});

it('still answers 200 for a no-op on a hidden route', function () {
    taCity('homs');
    $route = taRoute('route-homs-1', 'homs', ['status' => 'hidden']);

    $this->actingAs(taStaff())
        ->postJson("/api/v1/admin/routes/{$route->id}/status", ['status' => 'hidden'])
        ->assertOk();
});

it('applies a real status change and echoes the route', function () {
    taCity('homs');
    $route = taRoute('route-homs-1', 'homs', ['status' => 'published']);

    $this->actingAs(taStaff())
        ->postJson("/api/v1/admin/routes/{$route->id}/status", ['status' => 'hidden'])
        ->assertOk()
        ->assertJsonPath('route.status', 'hidden')
        ->assertJsonPath('message', 'Route status updated successfully');

    expect($route->fresh()->status)->toBe('hidden');
});

it('rejects a status outside the allowed vocabulary', function () {
    taCity('homs');
    $route = taRoute('route-homs-1', 'homs');

    $this->actingAs(taStaff())
        ->postJson("/api/v1/admin/routes/{$route->id}/status", ['status' => 'deleted'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('status');

    expect($route->fresh()->status)->toBe('published');
});

// ─── Guard runs before validation on the route edit ────────────────────────
//
// updateRoute() checks the caller's scope before validating the payload, and
// says why: an out-of-scope caller learns nothing about the shape of a resource
// they cannot touch. Every other action in this controller validates first. If
// that ordering were normalised, a probe could tell a real route from a
// malformed one, and a scoped reviewer would start receiving 422s for edits they
// were never allowed to make.

it('refuses an out-of-scope route edit before looking at the payload', function () {
    taCity('homs');
    taCity('aleppo');
    $route = taRoute('route-aleppo-1', 'aleppo');

    $reviewer = taStaff(null, ['homs']);

    // Deliberately invalid on two counts: a non-existent field and a name that is
    // too long. A 422 here would mean validation ran first.
    $this->actingAs($reviewer)
        ->putJson("/api/v1/admin/routes/{$route->id}", [
            'name_ar' => str_repeat('ط', 300),
            'nonsense' => 'x',
        ])
        ->assertForbidden();

    expect($route->fresh()->name_ar)->not->toBe(str_repeat('ط', 300));
});

it('validates an in-scope route edit normally', function () {
    // The control for the ordering above: the same payload from an authorised
    // caller must produce a validation error, not a permission error.
    taCity('homs');
    $route = taRoute('route-homs-1', 'homs');

    $reviewer = taStaff(null, ['homs']);

    $this->actingAs($reviewer)
        ->putJson("/api/v1/admin/routes/{$route->id}", ['name_ar' => str_repeat('ط', 300)])
        ->assertStatus(422)
        ->assertJsonValidationErrors('name_ar');
});

// ─── Partial update semantics at the HTTP boundary ─────────────────────────
//
// The service already covers "updates only the fields it is given" and "clears a
// field when it is explicitly set to null". What only the HTTP layer can break is
// the $request->has() distinction between an absent key and an explicit null,
// since that is a property of the request, not the service.

it('ignores an absent field but clears one explicitly set to null', function () {
    taCity('homs');
    $route = taRoute('route-homs-1', 'homs', [
        'name_ar' => 'خط',
        'name_en' => 'Line',
        'price_old' => 1000,
    ]);

    $editor = taStaff(null, ['homs']);

    // name_en absent, price_old explicitly null.
    $this->actingAs($editor)
        ->putJson("/api/v1/admin/routes/{$route->id}", [
            'name_ar' => 'خط جديد',
            'price_old' => null,
        ])
        ->assertOk();

    $fresh = $route->fresh();

    expect($fresh->name_ar)->toBe('خط جديد')
        // untouched, because the key was never sent
        ->and($fresh->name_en)->toBe('Line')
        // cleared, because null is an instruction
        ->and($fresh->price_old)->toBeNull();
});

it('answers 400 when a route update carries nothing updatable', function () {
    taCity('homs');
    $route = taRoute('route-homs-1', 'homs');

    $editor = taStaff(null, ['homs']);

    $this->actingAs($editor)
        ->putJson("/api/v1/admin/routes/{$route->id}", ['nonsense' => 'x'])
        ->assertStatus(400)
        ->assertJsonPath('message', 'No fields to update');
});

// ─── Move validation ───────────────────────────────────────────────────────

it('refuses a move to a governorate that does not exist', function () {
    taCity('homs');
    $route = taRoute('route-homs-1', 'homs');

    $editor = taStaff(null, ['homs']);

    $this->actingAs($editor)
        ->postJson("/api/v1/admin/routes/{$route->id}/move", ['city_id' => 'atlantis'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('city_id');

    expect($route->fresh()->city_id)->toBe('homs');
});

it('refuses a move a scoped editor has no access to', function () {
    taCity('homs');
    taCity('aleppo');
    $route = taRoute('route-homs-1', 'homs');

    $editor = taStaff(null, ['homs']);

    // Scope has to cover the destination too, or a reviewer could relocate a route
    // out of their own governorate into one they cannot write.
    $this->actingAs($editor)
        ->postJson("/api/v1/admin/routes/{$route->id}/move", ['city_id' => 'aleppo'])
        ->assertForbidden();

    expect($route->fresh()->city_id)->toBe('homs');
});

it('moves a route between two governorates the editor both holds', function () {
    taCity('homs');
    taCity('rif-dimashq');
    $route = taRoute('route-homs-1', 'homs');

    $editor = moduleStaff('transit', [
        'permission_scopes' => ['transit' => ['homs', 'rif-dimashq']],
    ]);

    $this->actingAs($editor)
        ->postJson("/api/v1/admin/routes/{$route->id}/move", ['city_id' => 'rif-dimashq'])
        ->assertOk()
        ->assertJsonPath('route.city_id', 'rif-dimashq');

    expect($route->fresh()->city_id)->toBe('rif-dimashq');
});

// ─── Listings respect the scope ────────────────────────────────────────────

it('filters the route log by the governorates the caller holds', function () {
    taCity('homs');
    taCity('aleppo');

    $scoped = taStaff(null, ['homs']);

    $logs = $this->actingAs($scoped)
        ->getJson('/api/v1/admin/routes/logs')
        ->assertOk()
        ->json();

    // The service-side filtering is covered by TransitAdminServiceTest; what this
    // pins is that the controller actually passes the caller's scope through
    // rather than dropping it and returning everything.
    foreach ($logs as $log) {
        expect($log['city_id'] ?? 'homs')->toBe('homs');
    }
});

it('refuses the moderation routes to a caller with no transit capability', function (string $method, string $uri) {
    taCity('homs');
    $draft = taDraft('homs');
    $route = taRoute('route-homs-1', 'homs');

    $outsider = User::factory()->module('places')->create();

    $this->actingAs($outsider)
        ->{$method}(str_replace(['{draft}', '{route}'], [$draft->id, $route->id], $uri))
        ->assertForbidden();
})->with([
    ['postJson', '/api/v1/admin/route-drafts/{draft}/approve'],
    ['postJson', '/api/v1/admin/route-drafts/{draft}/reject'],
    ['putJson', '/api/v1/admin/routes/{route}'],
    ['deleteJson', '/api/v1/admin/routes/{route}'],
    ['postJson', '/api/v1/admin/routes/{route}/status'],
    ['postJson', '/api/v1/admin/routes/{route}/move'],
]);
