<?php

use App\Mcp\Tools\Transit\ApproveTransitDraftTool;
use App\Mcp\Tools\Transit\DeleteTransitRouteTool;
use App\Mcp\Tools\Transit\GetTransitDraftGeometryTool;
use App\Mcp\Tools\Transit\ListTransitDraftsTool;
use App\Mcp\Tools\Transit\ListTransitRouteHistoryTool;
use App\Mcp\Tools\Transit\ListTransitRoutesTool;
use App\Mcp\Tools\Transit\MoveTransitRouteTool;
use App\Mcp\Tools\Transit\RejectTransitDraftTool;
use App\Mcp\Tools\Transit\SetTransitRouteStatusTool;
use App\Mcp\Tools\Transit\UpdateTransitRouteTool;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\TransitRouteLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| Transit tools
|--------------------------------------------------------------------------
|
| Transit is the only governorate-scoped module, and the scope cannot be read
| off the tool arguments: approving draft 91 acts on whichever governorate that
| draft lives in, which is a database fact. So the tools resolve their target
| first and then guard. Most of these tests exist to prove that a scoped agent
| cannot reach outside its governorates by any route — including the indirect
| ones, like moving a route out of scope, or a linked edit whose target route
| sits in a different governorate than the draft.
|
*/

beforeEach(function () {
    $this->homs = transitToolCity('homs', 'حمص', 'Homs');
    $this->aleppo = transitToolCity('aleppo', 'حلب', 'Aleppo');

    $this->scoped = User::factory()->create([
        'role' => 'user',
        'permissions' => [
            'transit.review_drafts', 'transit.approve', 'transit.reject',
            'transit.edit_routes', 'transit.delete_routes',
        ],
        'permission_scopes' => ['transit' => ['homs']],
    ]);
});

function transitToolCity(string $id, string $nameAr, string $nameEn): string
{
    $wrap = static function (array $shape) {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return json_encode($shape, JSON_THROW_ON_ERROR);
        }

        return DB::raw('ST_GeomFromGeoJSON('.DB::connection()->getPdo()->quote(json_encode($shape, JSON_THROW_ON_ERROR)).')');
    };

    DB::table('cities')->insert([
        'id' => $id,
        'name_ar' => $nameAr,
        'name_en' => $nameEn,
        'center' => $wrap(['type' => 'Point', 'coordinates' => [36.72, 34.73]]),
        'bounds' => $wrap(['type' => 'Polygon', 'coordinates' => [[[36.5, 34.55], [36.95, 34.55], [36.95, 34.95], [36.5, 34.95], [36.5, 34.55]]]]),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return $id;
}

function transitToolDraft(string $cityId, array $overrides = []): RouteDraft
{
    return RouteDraft::create(array_merge([
        'user_id' => null,
        'city_id' => $cityId,
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ], $overrides));
}

function transitToolRoute(string $id, string $cityId, array $overrides = []): Route
{
    return Route::create(array_merge([
        'id' => $id,
        'city_id' => $cityId,
        'name_ar' => 'خط',
        'status' => 'published',
    ], $overrides));
}

// ─── Listings are narrowed, never widened ──────────────────────────────────

it('only lists drafts inside the agent governorate scope', function () {
    transitToolDraft('homs', ['name_ar' => 'داخل النطاق']);
    transitToolDraft('aleppo', ['name_ar' => 'خارج النطاق']);

    agentToken($this->scoped, ['transit.review_drafts']);
    $payload = toolPayload(callTool(ListTransitDraftsTool::class));

    expect($payload['count'])->toBe(1)
        ->and($payload['drafts'][0]['name_ar'])->toBe('داخل النطاق')
        // The listing says so explicitly, so an agent does not mistake a narrow
        // result for an empty queue.
        ->and($payload['scope'])->toBe(['homs']);
});

it('only lists routes inside the agent governorate scope', function () {
    transitToolRoute('route-homs-1', 'homs');
    transitToolRoute('route-aleppo-1', 'aleppo');

    agentToken($this->scoped, ['transit.review_drafts']);
    $payload = toolPayload(callTool(ListTransitRoutesTool::class));

    expect($payload['count'])->toBe(1)
        ->and($payload['routes'][0]['id'])->toBe('route-homs-1');
});

it('only lists history for routes inside the agent governorate scope', function () {
    transitToolRoute('route-homs-1', 'homs');
    transitToolRoute('route-aleppo-1', 'aleppo');
    TransitRouteLog::create(['route_id' => 'route-homs-1', 'action' => 'a', 'description' => 'h', 'user_id' => null]);
    TransitRouteLog::create(['route_id' => 'route-aleppo-1', 'action' => 'a', 'description' => 'a', 'user_id' => null]);

    agentToken($this->scoped, ['transit.review_drafts']);
    $payload = toolPayload(callTool(ListTransitRouteHistoryTool::class));

    expect($payload['count'])->toBe(1)
        ->and($payload['entries'][0]['route_id'])->toBe('route-homs-1');
});

it('refuses an explicit governorate filter outside the agent scope', function () {
    transitToolDraft('aleppo');

    agentToken($this->scoped, ['transit.review_drafts']);
    $response = callTool(ListTransitDraftsTool::class, ['city_id' => 'aleppo']);

    expect(toolText($response))->toContain('Permission denied')
        ->and(toolText($response))->toContain('aleppo');
});

it('lists everything for an unscoped operator', function () {
    $unscoped = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.review_drafts'],
        'permission_scopes' => null,
    ]);

    transitToolDraft('homs');
    transitToolDraft('aleppo');

    agentToken($unscoped, ['transit.review_drafts']);
    $payload = toolPayload(callTool(ListTransitDraftsTool::class));

    expect($payload['count'])->toBe(2)
        ->and($payload['scope'])->toBe([]);
});

// ─── Writes guard against the resolved target, not the arguments ───────────

it('refuses to approve a draft in a governorate outside the agent scope', function () {
    $draft = transitToolDraft('aleppo');

    agentToken($this->scoped, ['transit.approve']);
    $response = callTool(ApproveTransitDraftTool::class, ['draft_id' => $draft->id]);

    expect(toolText($response))->toContain('Permission denied')
        ->and($draft->fresh()->status)->toBe('pending');
});

it('approves a draft inside the agent scope', function () {
    $draft = transitToolDraft('homs', ['name_ar' => 'خط جديد']);

    agentToken($this->scoped, ['transit.approve']);
    $payload = toolPayload(callTool(ApproveTransitDraftTool::class, ['draft_id' => $draft->id]));

    expect($payload['approved'])->toBeTrue()
        ->and($payload['route']['name_ar'])->toBe('خط جديد')
        ->and($payload['route']['status'])->toBe('published');
});

/*
 * A linked edit touches two governorates: the draft's own, and the live route
 * it targets. If those differ, the draft being in scope is not enough — the
 * route being rewritten is data the agent is not cleared for.
 */
it('refuses a linked edit whose target route is in a governorate outside the agent scope', function () {
    transitToolRoute('route-aleppo-1', 'aleppo', ['name_ar' => 'القديم', 'status' => 'disapproved']);
    $draft = transitToolDraft('homs', ['route_id' => 'route-aleppo-1', 'name_ar' => 'المحدث']);

    agentToken($this->scoped, ['transit.approve']);
    $response = callTool(ApproveTransitDraftTool::class, ['draft_id' => $draft->id]);

    expect(toolText($response))->toContain('Permission denied')
        ->and($draft->fresh()->status)->toBe('pending')
        ->and(Route::find('route-aleppo-1')->name_ar)->toBe('القديم')
        ->and(Route::find('route-aleppo-1')->status)->toBe('disapproved');
});

it('refuses to reject a draft outside the agent scope', function () {
    $draft = transitToolDraft('aleppo');

    agentToken($this->scoped, ['transit.reject']);
    $response = callTool(RejectTransitDraftTool::class, ['draft_id' => $draft->id, 'reason' => 'لا']);

    expect(toolText($response))->toContain('Permission denied')
        ->and($draft->fresh()->status)->toBe('pending');
});

it('refuses a status change on a route outside the agent scope', function () {
    $route = transitToolRoute('route-aleppo-1', 'aleppo');

    agentToken($this->scoped, ['transit.edit_routes']);
    $response = callTool(SetTransitRouteStatusTool::class, [
        'route_id' => 'route-aleppo-1',
        'status' => 'hidden',
    ]);

    expect(toolText($response))->toContain('Permission denied')
        ->and($route->fresh()->status)->toBe('published');
});

it('refuses to delete a route outside the agent scope', function () {
    transitToolRoute('route-aleppo-1', 'aleppo');

    agentToken($this->scoped, ['transit.delete_routes']);
    $response = callTool(DeleteTransitRouteTool::class, ['route_id' => 'route-aleppo-1']);

    expect(toolText($response))->toContain('Permission denied')
        ->and(Route::find('route-aleppo-1'))->not->toBeNull();
});

it('refuses to read a draft geometry outside the agent scope', function () {
    $draft = transitToolDraft('aleppo');

    agentToken($this->scoped, ['transit.review_drafts']);
    $response = callTool(GetTransitDraftGeometryTool::class, ['draft_id' => $draft->id]);

    expect(toolText($response))->toContain('Permission denied');
});

/*
 * A move has two ends. An agent scoped to Homs could otherwise relocate a route
 * into Aleppo, which is a write into a governorate it is not cleared for, and
 * would also strip the source's map cache.
 */
it('refuses to move a route out of scope into a governorate it cannot write', function () {
    $route = transitToolRoute('route-homs-1', 'homs');

    agentToken($this->scoped, ['transit.edit_routes']);
    $response = callTool(MoveTransitRouteTool::class, [
        'route_id' => 'route-homs-1',
        'city_id' => 'aleppo',
    ]);

    expect(toolText($response))->toContain('Permission denied')
        ->and($route->fresh()->city_id)->toBe('homs');
});

// ─── Capability isolation ──────────────────────────────────────────────────

it('refuses approving with only the review capability', function () {
    $draft = transitToolDraft('homs');

    agentToken($this->scoped, ['transit.review_drafts']);
    $response = callTool(ApproveTransitDraftTool::class, ['draft_id' => $draft->id]);

    expect(toolText($response))->toContain('Permission denied')
        ->and($draft->fresh()->status)->toBe('pending');
});

it('refuses deleting with only the edit capability', function () {
    transitToolRoute('route-homs-1', 'homs');

    agentToken($this->scoped, ['transit.edit_routes']);
    $response = callTool(DeleteTransitRouteTool::class, ['route_id' => 'route-homs-1']);

    expect(toolText($response))->toContain('Permission denied')
        ->and(Route::find('route-homs-1'))->not->toBeNull();
});

// ─── Domain refusals reach the agent as guidance ───────────────────────────

it('tells the agent a draft is already reviewed instead of failing opaquely', function () {
    $draft = transitToolDraft('homs', ['status' => 'approved']);

    agentToken($this->scoped, ['transit.approve']);
    $response = callTool(ApproveTransitDraftTool::class, ['draft_id' => $draft->id]);

    expect(toolText($response))->toContain('already approved')
        ->and(toolText($response))->toContain('Re-read the draft');
});

it('reports a status no-op as nothing to do', function () {
    transitToolRoute('route-homs-1', 'homs', ['status' => 'published']);

    agentToken($this->scoped, ['transit.edit_routes']);
    $response = callTool(SetTransitRouteStatusTool::class, [
        'route_id' => 'route-homs-1',
        'status' => 'published',
    ]);

    expect(toolText($response))->toContain('Nothing to do');
});

it('refuses an update carrying no fields, naming the ones it accepts', function () {
    transitToolRoute('route-homs-1', 'homs');

    agentToken($this->scoped, ['transit.edit_routes']);
    $response = callTool(UpdateTransitRouteTool::class, [
        'route_id' => 'route-homs-1',
    ]);

    expect(toolText($response))->toContain('No fields to update')
        ->and(toolText($response))->toContain('name_ar');
});

// ─── The geometry a reviewer needs ─────────────────────────────────────────

it('returns a draft line and its stops as GeoJSON', function () {
    $draft = transitToolDraft('homs', [
        'geojson' => [
            'type' => 'FeatureCollection',
            'features' => [
                ['type' => 'Feature', 'geometry' => ['type' => 'LineString', 'coordinates' => [[36.7, 34.7], [36.8, 34.8]]], 'properties' => []],
                ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => [36.7, 34.7]], 'properties' => ['nameAr' => 'المحطة الأولى']],
                ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => [36.8, 34.8]], 'properties' => ['nameAr' => '  ']],
            ],
        ],
    ]);

    agentToken($this->scoped, ['transit.review_drafts']);
    $payload = toolPayload(callTool(GetTransitDraftGeometryTool::class, ['draft_id' => $draft->id]));

    expect($payload['line']['type'])->toBe('LineString')
        ->and($payload['line']['coordinates'])->toBe([[36.7, 34.7], [36.8, 34.8]])
        ->and($payload['stops'])->toHaveCount(2)
        ->and($payload['stops'][0]['name_ar'])->toBe('المحطة الأولى')
        // A whitespace-only name is reported as absent rather than as a blank.
        ->and($payload['stops'][1]['name_ar'])->toBeNull();
});

it('returns an empty geometry for a draft that carries no features', function () {
    $draft = transitToolDraft('homs');

    agentToken($this->scoped, ['transit.review_drafts']);
    $payload = toolPayload(callTool(GetTransitDraftGeometryTool::class, ['draft_id' => $draft->id]));

    expect($payload['line'])->toBeNull()
        ->and($payload['stops'])->toBe([]);
});
