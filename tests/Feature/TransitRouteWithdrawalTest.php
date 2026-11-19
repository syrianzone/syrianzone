<?php

use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\Stop;
use App\Models\User;
use App\Services\Transit\TransitAdminService;
use Illuminate\Support\Facades\DB;

// Submitting an edit to a published route used to take it off the public map
// for anyone signed in, so any account could take every route in a city
// offline; withdrawing the edit then left the route offline for good.

function editPayload(Route $route): array
{
    return [
        'city_id' => $route->city_id,
        'route_id' => $route->id,
        'name_ar' => 'تعديل مقترح',
        'geojson' => [
            'type' => 'FeatureCollection',
            'features' => [
                ['type' => 'Feature', 'properties' => [], 'geometry' => ['type' => 'LineString', 'coordinates' => [[36.66, 34.73], [36.68, 34.735]]]],
            ],
        ],
    ];
}

test('an ordinary user\'s edit suggestion leaves the live route on the map', function () {
    seedCity('homs');
    $route = transitRoute('route-homs-1', 'homs');

    $this->actingAs(User::factory()->create())
        ->postJson('/api/v1/studio/routes', editPayload($route))
        ->assertCreated();

    expect($route->fresh()->status)->toBe('published');
});

test('an ordinary user\'s update to their suggestion leaves the live route on the map', function () {
    seedCity('homs');
    $route = transitRoute('route-homs-1', 'homs');
    $user = User::factory()->create();
    $draft = transitDraft('homs', ['user_id' => $user->id, 'route_id' => $route->id]);

    $this->actingAs($user)
        ->putJson("/api/v1/studio/routes/{$draft->id}", ['name_ar' => 'تعديل آخر'])
        ->assertOk();

    expect($route->fresh()->status)->toBe('published');
});

test('a transit editor\'s edit withdraws the route, and withdrawing the edit restores it', function () {
    seedCity('homs');
    $route = transitRoute('route-homs-1', 'homs');
    $editor = moduleStaff('transit');

    $draftId = $this->actingAs($editor)
        ->postJson('/api/v1/studio/routes', editPayload($route))
        ->assertCreated()
        ->json('id');

    expect($route->fresh()->status)->toBe('disapproved');

    $this->actingAs($editor)->deleteJson("/api/v1/studio/routes/{$draftId}")->assertOk();

    expect($route->fresh()->status)->toBe('published')
        ->and(RouteDraft::find($draftId))->toBeNull();
});

test('rejecting a suggestion does not republish a route an admin had withdrawn', function () {
    seedCity('homs');
    $route = transitRoute('route-homs-1', 'homs', ['status' => 'disapproved']);
    $user = User::factory()->create();

    $draftId = $this->actingAs($user)
        ->postJson('/api/v1/studio/routes', editPayload($route))
        ->assertCreated()
        ->json('id');

    app(TransitAdminService::class)->rejectDraft(RouteDraft::find($draftId), 'لا', null);

    expect($route->fresh()->status)->toBe('disapproved');
});

test('withdrawing one suggestion does not undo another editor\'s pending withdrawal', function () {
    // A user files suggestion A, then an editor's edit B takes the route off
    // the map. Withdrawing A must not republish the route while B is pending.
    seedCity('homs');
    $route = transitRoute('route-homs-1', 'homs');
    $user = User::factory()->create();
    $editor = moduleStaff('transit');

    $suggestionA = $this->actingAs($user)
        ->postJson('/api/v1/studio/routes', editPayload($route))
        ->assertCreated()
        ->json('id');
    $editB = $this->actingAs($editor)
        ->postJson('/api/v1/studio/routes', editPayload($route))
        ->assertCreated()
        ->json('id');
    expect($route->fresh()->status)->toBe('disapproved');

    $this->actingAs($user)->deleteJson("/api/v1/studio/routes/{$suggestionA}")->assertOk();
    expect($route->fresh()->status)->toBe('disapproved');

    app(TransitAdminService::class)->rejectDraft(RouteDraft::find($editB), 'لا', null);
    expect($route->fresh()->status)->toBe('published');
});

test('an admin status change after a withdrawal is not undone when the edit ends', function () {
    seedCity('homs');
    $route = transitRoute('route-homs-1', 'homs');
    $editor = moduleStaff('transit');

    $edit = $this->actingAs($editor)
        ->postJson('/api/v1/studio/routes', editPayload($route))
        ->assertCreated()
        ->json('id');

    // An admin hides the route, then disapproves it again for their own reasons.
    $service = app(TransitAdminService::class);
    $service->setRouteStatus($route->fresh(), 'hidden', null);
    $service->setRouteStatus($route->fresh(), 'disapproved', null);

    $service->rejectDraft(RouteDraft::find($edit), 'لا', null);
    expect($route->fresh()->status)->toBe('disapproved');
});

test('public transit search returns only published routes and their stops', function () {
    seedCity('damascus');
    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    $live = transitRoute('route-live', 'damascus', ['name_ar' => 'خط ظاهر']);
    transitRoute('route-hidden', 'damascus', ['name_ar' => 'خط مخفي', 'status' => 'hidden']);
    transitRoute('route-withdrawn', 'damascus', ['name_ar' => 'خط مسحوب', 'status' => 'disapproved']);

    foreach (['stop-live' => 'route-live', 'stop-hidden' => 'route-hidden'] as $stopId => $routeId) {
        Stop::create([
            'id' => $stopId,
            'city_id' => 'damascus',
            'name_ar' => 'محطة '.$stopId,
            'geometry' => spatialValue(['type' => 'Point', 'coordinates' => [36.29, 33.51]]),
        ]);
        DB::table('route_stop')->insert(['route_id' => $routeId, 'stop_id' => $stopId, 'order' => 1]);
    }

    $routes = collect($this->getJson('/api/v1/transit/search?q='.urlencode('خط'))->assertOk()->json('routes'))->pluck('id');
    $stops = collect($this->getJson('/api/v1/transit/search?q='.urlencode('محطة'))->assertOk()->json('stops'))->pluck('id');

    expect($routes->all())->toBe([$live->id])
        ->and($stops->all())->toBe(['stop-live']);
});
