<?php

use App\Exceptions\Transit\TransitActionException;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\TransitRouteLog;
use App\Models\User;
use App\Services\Transit\TransitAdminService;
use App\Services\Transit\TransitCache;
use App\Services\Transit\TransitRouteComposer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| Transit admin service
|--------------------------------------------------------------------------
|
| The spatial SQL cannot run on SQLite, so these cover the operations and paths
| that do not need it: geometry-less drafts, routes without stops, and the
| refusals. Two tests at the bottom are regression tests for real defects found
| while extracting this service — read their comments.
|
*/

beforeEach(function () {
    $this->service = app(TransitAdminService::class);
    $this->actor = User::factory()->create();
});

/**
 * Cities.center and .bounds are NOT NULL, and their type is spatial on MySQL.
 * Store plain JSON on SQLite, and hand the driver real geometry on MySQL so this
 * file also works against a real database.
 */
function transitCity(string $id, string $nameAr = 'مدينة', string $nameEn = 'City'): void
{
    $point = ['type' => 'Point', 'coordinates' => [36.72, 34.73]];
    $polygon = ['type' => 'Polygon', 'coordinates' => [[[36.5, 34.55], [36.95, 34.55], [36.95, 34.95], [36.5, 34.95], [36.5, 34.55]]]];

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
        'center' => $wrap($point),
        'bounds' => $wrap($polygon),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

function transitDraft(string $cityId, array $overrides = []): RouteDraft
{
    return RouteDraft::create(array_merge([
        'user_id' => null,
        'city_id' => $cityId,
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ], $overrides));
}

function transitRoute(string $id, string $cityId, array $overrides = []): Route
{
    return Route::create(array_merge([
        'id' => $id,
        'city_id' => $cityId,
        'name_ar' => 'خط',
        'status' => 'published',
    ], $overrides));
}

// ─── Approve ────────────────────────────────────────────────────────────────

it('approves an original draft into a new published route', function () {
    transitCity('homs', 'حمص', 'Homs');
    $draft = transitDraft('homs', ['name_ar' => 'خط جديد', 'name_en' => 'New', 'price' => 500]);

    $route = $this->service->approveDraft($draft, null, $this->actor->id);

    expect($route)->not->toBeNull()
        ->and($route->city_id)->toBe('homs')
        ->and($route->name_ar)->toBe('خط جديد')
        ->and($route->price_new)->toBe(500)
        ->and($route->status)->toBe('published')
        ->and($route->id)->toStartWith('route-homs-')
        ->and($draft->fresh()->status)->toBe('approved');
});

it('keeps the contributor colour when the reviewer does not pick one', function () {
    transitCity('homs');
    $draft = transitDraft('homs', ['color_index' => 4]);

    $route = $this->service->approveDraft($draft, null, $this->actor->id);

    expect($route->color_index)->toBe(4);
});

it('lets the reviewer override the contributor colour', function () {
    transitCity('homs');
    $draft = transitDraft('homs', ['color_index' => 4]);

    $route = $this->service->approveDraft($draft, 9, $this->actor->id);

    expect($route->color_index)->toBe(9);
});

it('refuses to approve a draft that is not pending', function () {
    transitCity('homs');
    $draft = transitDraft('homs', ['status' => 'approved']);

    $this->service->approveDraft($draft, null, $this->actor->id);
})->throws(TransitActionException::class, 'is already approved');

/*
 * REGRESSION. TransitStudioController::unpublishLinkedRoute() takes a route off
 * the public map the moment an edit is submitted against it. The reject path
 * restored it, but the approve path did not: accepting an edit left the route
 * permanently 'disapproved' and therefore invisible to every public user. This
 * asserts approving puts it back.
 */
it('republishes a linked route when its edit is approved', function () {
    transitCity('homs');
    $route = transitRoute('route-homs-1', 'homs', ['name_ar' => 'القديم', 'status' => 'disapproved']);
    $draft = transitDraft('homs', ['route_id' => 'route-homs-1', 'name_ar' => 'المحدث']);

    $result = $this->service->approveDraft($draft, null, $this->actor->id);

    expect($result->id)->toBe('route-homs-1')
        ->and($result->status)->toBe('published')
        ->and($result->name_ar)->toBe('المحدث')
        ->and($draft->fresh()->status)->toBe('approved');

    expect(TransitRouteLog::where('route_id', 'route-homs-1')->where('action', 'updated_via_draft')->exists())
        ->toBeTrue();
});

// ─── Reject ─────────────────────────────────────────────────────────────────

it('rejects a draft and records the reason', function () {
    transitCity('homs');
    $draft = transitDraft('homs');

    $this->service->rejectDraft($draft, 'الاسم غير دقيق', $this->actor->id);

    expect($draft->fresh()->status)->toBe('rejected')
        ->and($draft->fresh()->rejection_reason)->toBe('الاسم غير دقيق');
});

it('republishes a linked route when its edit is rejected', function () {
    transitCity('homs');
    transitRoute('route-homs-1', 'homs', ['status' => 'disapproved']);
    $draft = transitDraft('homs', ['route_id' => 'route-homs-1']);

    $this->service->rejectDraft($draft, 'لا', $this->actor->id);

    expect(Route::find('route-homs-1')->status)->toBe('published')
        ->and(TransitRouteLog::where('action', 'restored_after_reject')->exists())->toBeTrue();
});

it('leaves a route alone on reject when it was not withdrawn for review', function () {
    transitCity('homs');
    transitRoute('route-homs-1', 'homs', ['status' => 'hidden']);
    $draft = transitDraft('homs', ['route_id' => 'route-homs-1']);

    $this->service->rejectDraft($draft, 'لا', $this->actor->id);

    // Only 'disapproved' means "withdrawn awaiting review". A route an admin had
    // deliberately hidden must not be silently republished.
    expect(Route::find('route-homs-1')->status)->toBe('hidden');
});

it('refuses to reject a draft that is not pending', function () {
    transitCity('homs');
    $draft = transitDraft('homs', ['status' => 'rejected']);

    $this->service->rejectDraft($draft, null, $this->actor->id);
})->throws(TransitActionException::class, 'is already rejected');

// ─── Status ─────────────────────────────────────────────────────────────────

it('changes a route status and logs the change', function () {
    transitCity('homs');
    $route = transitRoute('route-homs-1', 'homs', ['status' => 'published']);

    $this->service->setRouteStatus($route, 'hidden', $this->actor->id);

    expect($route->fresh()->status)->toBe('hidden')
        ->and(TransitRouteLog::where('route_id', 'route-homs-1')->where('action', 'hidden')->exists())
        ->toBeTrue();
});

it('refuses a status change that would change nothing', function () {
    transitCity('homs');
    $route = transitRoute('route-homs-1', 'homs', ['status' => 'published']);

    $this->service->setRouteStatus($route, 'published', $this->actor->id);
})->throws(TransitActionException::class, 'is already published');

// ─── Field updates ──────────────────────────────────────────────────────────

it('updates only the fields it is given', function () {
    transitCity('homs');
    $route = transitRoute('route-homs-1', 'homs', [
        'name_ar' => 'قديم', 'name_en' => 'Old', 'price_new' => 100, 'price_old' => 90,
    ]);

    $this->service->updateRoute($route, ['name_ar' => 'جديد'], $this->actor->id);

    $fresh = $route->fresh();
    expect($fresh->name_ar)->toBe('جديد')
        // Untouched: an update must not clear fields it was not asked about.
        ->and($fresh->name_en)->toBe('Old')
        ->and($fresh->price_new)->toBe(100)
        ->and($fresh->price_old)->toBe(90);
});

it('clears a field when it is explicitly set to null', function () {
    transitCity('homs');
    $route = transitRoute('route-homs-1', 'homs', ['name_en' => 'Old', 'price_old' => 90]);

    $this->service->updateRoute($route, ['name_en' => null, 'price_old' => null], $this->actor->id);

    expect($route->fresh()->name_en)->toBeNull()
        ->and($route->fresh()->price_old)->toBeNull();
});

it('refuses an update carrying no recognised fields', function () {
    transitCity('homs');
    $route = transitRoute('route-homs-1', 'homs');

    $this->service->updateRoute($route, ['status' => 'hidden'], $this->actor->id);
})->throws(TransitActionException::class, 'No fields to update');

// ─── Move ───────────────────────────────────────────────────────────────────

it('moves a stop-less route to another governorate and clears both caches', function () {
    transitCity('homs', 'حمص', 'Homs');
    transitCity('aleppo', 'حلب', 'Aleppo');
    $route = transitRoute('route-homs-1', 'homs');

    Cache::put('transit:map-data:homs', 'stale', 600);
    Cache::put('transit:map-data:aleppo', 'stale', 600);
    Cache::put('transit:routes:homs', 'stale', 600);
    Cache::put('transit:cities', 'stale', 600);

    $this->service->moveRoute($route, 'aleppo', $this->actor->id);

    expect($route->fresh()->city_id)->toBe('aleppo')
        ->and(Cache::has('transit:map-data:homs'))->toBeFalse()
        ->and(Cache::has('transit:map-data:aleppo'))->toBeFalse()
        ->and(Cache::has('transit:routes:homs'))->toBeFalse()
        ->and(Cache::has('transit:cities'))->toBeFalse();
});

it('refuses a move to the governorate the route is already in', function () {
    transitCity('homs');
    $route = transitRoute('route-homs-1', 'homs');

    $this->service->moveRoute($route, 'homs', $this->actor->id);
})->throws(TransitActionException::class, 'already belongs to governorate homs');

// ─── Delete ─────────────────────────────────────────────────────────────────

it('deletes a route and prunes the stops nothing references any more', function () {
    transitCity('homs');
    $route = transitRoute('route-homs-1', 'homs', ['name_ar' => 'خط المحذوف']);

    DB::table('stops')->insert([
        ['id' => 'stop-a', 'city_id' => 'homs', 'name_ar' => 'أ', 'geometry' => 'x', 'created_at' => now(), 'updated_at' => now()],
        ['id' => 'stop-b', 'city_id' => 'homs', 'name_ar' => 'ب', 'geometry' => 'x', 'created_at' => now(), 'updated_at' => now()],
    ]);
    DB::table('route_stop')->insert([
        ['route_id' => 'route-homs-1', 'stop_id' => 'stop-a', 'order' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['route_id' => 'route-homs-1', 'stop_id' => 'stop-b', 'order' => 2, 'created_at' => now(), 'updated_at' => now()],
    ]);

    $removed = $this->service->destroyRoute($route, $this->actor->id);

    expect(Route::find('route-homs-1'))->toBeNull()
        ->and(DB::table('route_stop')->where('route_id', 'route-homs-1')->count())->toBe(0)
        ->and($removed)->toBe(2)
        ->and(DB::table('stops')->count())->toBe(0)
        ->and(TransitRouteLog::where('action', 'deleted')->exists())->toBeTrue();
});

it('keeps a stop that another route still references', function () {
    transitCity('homs');
    transitRoute('route-homs-1', 'homs');
    transitRoute('route-homs-2', 'homs');

    DB::table('stops')->insert([
        ['id' => 'shared', 'city_id' => 'homs', 'name_ar' => 'مشترك', 'geometry' => 'x', 'created_at' => now(), 'updated_at' => now()],
    ]);
    DB::table('route_stop')->insert([
        ['route_id' => 'route-homs-1', 'stop_id' => 'shared', 'order' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['route_id' => 'route-homs-2', 'stop_id' => 'shared', 'order' => 1, 'created_at' => now(), 'updated_at' => now()],
    ]);

    $this->service->destroyRoute(Route::find('route-homs-1'), $this->actor->id);

    expect(DB::table('stops')->where('id', 'shared')->exists())->toBeTrue();
});

// ─── Scope filtering on the listings ────────────────────────────────────────

it('filters every listing by the governorates it is given', function () {
    transitCity('homs');
    transitCity('aleppo');

    transitRoute('route-homs-1', 'homs');
    transitRoute('route-aleppo-1', 'aleppo');
    transitDraft('homs');
    transitDraft('aleppo');

    TransitRouteLog::create(['route_id' => 'route-homs-1', 'action' => 'a', 'description' => 'd', 'user_id' => null]);
    TransitRouteLog::create(['route_id' => 'route-aleppo-1', 'action' => 'a', 'description' => 'd', 'user_id' => null]);

    expect($this->service->drafts(['homs']))->toHaveCount(1)
        ->and($this->service->routes(['homs'])->pluck('id')->all())->toBe(['route-homs-1'])
        ->and($this->service->logs(['aleppo'])->pluck('route_id')->all())->toBe(['route-aleppo-1']);
});

it('returns everything when the governorate filter is null', function () {
    transitCity('homs');
    transitCity('aleppo');
    transitRoute('route-homs-1', 'homs');
    transitRoute('route-aleppo-1', 'aleppo');

    expect($this->service->routes(null))->toHaveCount(2);
});

// ─── Combined Damascus / Rif Dimashq cache invalidation ─────────────────────

it('invalidates the combined map when either of the paired governorates changes', function () {
    transitCity('damascus');
    transitCity('rif-dimashq');

    Cache::put('transit:map-data:damascus', 'stale', 600);
    Cache::put('transit:map-data:rif-dimashq', 'stale', 600);
    Cache::put('transit:routes:damascus+rif-dimashq', 'stale', 600);
    Cache::put('transit:routes:aleppo', 'stale', 600);

    app(TransitCache::class)->forgetCity('rif-dimashq');

    expect(Cache::has('transit:map-data:damascus'))->toBeFalse()
        ->and(Cache::has('transit:map-data:rif-dimashq'))->toBeFalse()
        ->and(Cache::has('transit:routes:damascus+rif-dimashq'))->toBeFalse()
        // An unrelated governorate must be left alone.
        ->and(Cache::has('transit:routes:aleppo'))->toBeTrue();
});

/*
 * REGRESSION. splitRoute() used to open a transaction and then return its 400
 * "cannot split at start or end stop" from inside the try block, without
 * committing or rolling back. The open transaction leaked onto the connection
 * for the rest of the request. The guard now runs before the transaction opens.
 */
it('refuses an end-stop split without leaving a transaction open', function () {
    transitCity('homs');
    $route = transitRoute('route-homs-1', 'homs');

    DB::table('stops')->insert([
        ['id' => 's1', 'city_id' => 'homs', 'name_ar' => '١', 'geometry' => 'x', 'created_at' => now(), 'updated_at' => now()],
        ['id' => 's2', 'city_id' => 'homs', 'name_ar' => '٢', 'geometry' => 'x', 'created_at' => now(), 'updated_at' => now()],
        ['id' => 's3', 'city_id' => 'homs', 'name_ar' => '٣', 'geometry' => 'x', 'created_at' => now(), 'updated_at' => now()],
    ]);
    DB::table('route_stop')->insert([
        ['route_id' => 'route-homs-1', 'stop_id' => 's1', 'order' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['route_id' => 'route-homs-1', 'stop_id' => 's2', 'order' => 2, 'created_at' => now(), 'updated_at' => now()],
        ['route_id' => 'route-homs-1', 'stop_id' => 's3', 'order' => 3, 'created_at' => now(), 'updated_at' => now()],
    ]);

    // RefreshDatabase already holds a transaction, so compare against the
    // current depth rather than assuming zero: the point is that a refused
    // split must not leave an *extra* transaction behind.
    $before = DB::transactionLevel();

    try {
        // s3 is the last stop, so this is refused.
        app(TransitRouteComposer::class)->split($route, 's3', [
            'name_a_ar' => 'أ', 'name_b_ar' => 'ب',
        ], $this->actor->id);

        $this->fail('Expected the split to be refused.');
    } catch (TransitActionException $e) {
        expect($e->kind)->toBe(TransitActionException::INVALID_SPLIT_STOP);
    }

    // The point of the fix: no additional transaction was left open.
    expect(DB::transactionLevel())->toBe($before);
});
