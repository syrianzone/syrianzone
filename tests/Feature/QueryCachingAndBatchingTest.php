<?php

use App\Http\Controllers\CompassController;
use App\Models\Candidate;
use App\Models\CompassResult;
use App\Models\HouseMember2026;
use App\Models\Poll;
use App\Models\Promise;
use App\Models\PromiseSector;
use App\Models\User;
use App\Services\Promises\PromiseSectorService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| Cached reads and batched writes
|--------------------------------------------------------------------------
|
| The pages below are served from a cache, and the writes below were folded
| from a statement per row into one or two. Neither may change what a visitor
| sees: a cached page has to follow every edit at once, and a batched write has
| to land exactly the rows and totals the row-by-row version did.
|
*/

beforeEach(fn () => Cache::flush());

function inertiaProp($response, string $key)
{
    return data_get($response->viewData('page'), 'props.'.$key);
}

// ─── /promises ─────────────────────────────────────────────────────────────

it('shows a newly published promise on the cached list at once', function () {
    Promise::factory()->published()->create(['title' => 'الأول']);
    expect(inertiaProp($this->get('/promises')->assertOk(), 'promises'))->toHaveCount(1);

    Promise::factory()->published()->create(['title' => 'الثاني']);

    expect(array_column(inertiaProp($this->get('/promises')->assertOk(), 'promises'), 'title'))
        ->toEqualCanonicalizing(['الأول', 'الثاني']);
});

it('follows an edit and a removal on the cached list at once', function () {
    $promise = Promise::factory()->published()->create(['title' => 'قبل']);
    $this->get('/promises')->assertOk();

    $promise->update(['title' => 'بعد']);
    expect(array_column(inertiaProp($this->get('/promises'), 'promises'), 'title'))->toBe(['بعد']);

    $promise->delete();
    expect(inertiaProp($this->get('/promises'), 'promises'))->toBe([]);
});

it('follows a sector reorder on the cached list at once', function () {
    PromiseSector::query()->delete();
    PromiseSector::create(['id' => 'alpha', 'label' => 'Alpha', 'order_column' => 0, 'is_active' => true]);
    PromiseSector::create(['id' => 'beta', 'label' => 'Beta', 'order_column' => 1, 'is_active' => true]);

    expect(array_column(inertiaProp($this->get('/promises'), 'filters.sectors'), 'id'))->toBe(['alpha', 'beta']);

    // The reorder is a query-builder update: no model event fires for it.
    app(PromiseSectorService::class)->reorder(['beta', 'alpha']);

    expect(array_column(inertiaProp($this->get('/promises'), 'filters.sectors'), 'id'))->toBe(['beta', 'alpha']);
});

// ─── /house ────────────────────────────────────────────────────────────────

it('follows a new house member on the cached roster at once', function () {
    HouseMember2026::create(['name_ar' => 'Adel', 'governorate_ar' => 'Damascus']);
    expect(inertiaProp($this->get('/house')->assertOk(), 'members2026'))->toHaveCount(1);

    HouseMember2026::create(['name_ar' => 'Baker', 'governorate_ar' => 'Homs']);

    expect(inertiaProp($this->get('/house')->assertOk(), 'members2026'))->toHaveCount(2);
});

// ─── Ballots ───────────────────────────────────────────────────────────────

it('writes one item per ranked candidate and adds each ballot to the day totals', function () {
    $poll = Poll::factory()->create(['slug' => 'batch']);
    [$a, $b, $c] = Candidate::factory()->count(3)->create(['poll_id' => $poll->id])->all();

    $tiers = [
        'S' => [['candidateId' => $a->id], ['candidateId' => $b->id]],
        'B' => [['candidateId' => $c->id]],
    ];

    $this->postJson('/api/submit', ['pollSlug' => 'batch', 'deviceId' => 'device-one', 'tiers' => $tiers])->assertOk();

    $first = DB::table('daily_scores')->where('poll_id', $poll->id)->get()->keyBy('candidate_id');

    expect(DB::table('ballot_items')->count())->toBe(3)
        ->and($first)->toHaveCount(3)
        ->and($first->every(fn ($row) => (int) $row->votes === 1))->toBeTrue()
        // First in a tier outranks second in it, and S outranks B.
        ->and((int) $first[$a->id]->score)->toBeGreaterThan((int) $first[$b->id]->score)
        ->and((int) $first[$b->id]->score)->toBeGreaterThan((int) $first[$c->id]->score);

    $this->postJson('/api/submit', ['pollSlug' => 'batch', 'deviceId' => 'device-two', 'tiers' => $tiers])->assertOk();

    $second = DB::table('daily_scores')->where('poll_id', $poll->id)->get()->keyBy('candidate_id');

    // Same three rows, exactly doubled: the upsert adds, it does not replace.
    expect($second)->toHaveCount(3)
        ->and(DB::table('ballot_items')->count())->toBe(6);

    foreach ([$a, $b, $c] as $candidate) {
        expect((int) $second[$candidate->id]->votes)->toBe(2)
            ->and((int) $second[$candidate->id]->score)->toBe(2 * (int) $first[$candidate->id]->score);
    }
});

it('leaves nothing behind when a ballot is rejected', function () {
    $poll = Poll::factory()->create(['slug' => 'batch']);
    $other = Poll::factory()->create(['slug' => 'other']);
    [$a, $b] = Candidate::factory()->count(2)->create(['poll_id' => $poll->id])->all();
    $foreign = Candidate::factory()->create(['poll_id' => $other->id]);

    $this->postJson('/api/submit', ['pollSlug' => 'batch', 'deviceId' => 'device-one', 'tiers' => [
        'S' => [['candidateId' => $a->id], ['candidateId' => $b->id], ['candidateId' => $foreign->id]],
    ]])->assertStatus(422);

    // The same candidate twice passes the eligibility read and fails inside the
    // transaction, after the ballot row exists: it must roll back whole.
    $this->postJson('/api/submit', ['pollSlug' => 'batch', 'deviceId' => 'device-two', 'tiers' => [
        'S' => [['candidateId' => $a->id], ['candidateId' => $b->id]],
        'A' => [['candidateId' => $a->id]],
    ]])->assertStatus(422);

    expect(DB::table('ballots')->count())->toBe(0)
        ->and(DB::table('ballot_items')->count())->toBe(0)
        ->and(DB::table('daily_scores')->count())->toBe(0);
});

// ─── Promise votes ─────────────────────────────────────────────────────────

it('keeps one vote row per voter when they change their mind', function () {
    $promise = Promise::factory()->published()->create();
    $url = "/api/v1/promises/{$promise->number}/vote";

    $this->postJson($url, ['believes' => true, 'device_id' => 'device-a'])
        ->assertOk()->assertJson(['votes' => ['yes' => 1, 'no' => 0]]);
    $this->postJson($url, ['believes' => false, 'device_id' => 'device-a'])
        ->assertOk()->assertJson(['votes' => ['yes' => 0, 'no' => 1]]);

    $rows = DB::table('promise_votes')->where('promise_id', $promise->id)->get();

    expect($rows)->toHaveCount(1)
        ->and((bool) $rows[0]->believes)->toBeFalse()
        ->and($rows[0]->created_at)->not->toBeNull();
});

// ─── Compass statistics ────────────────────────────────────────────────────

function tallyRun(array $overrides = []): CompassResult
{
    return CompassResult::create(array_merge([
        'user_id' => null,
        'version' => 'short',
        'answers' => ['auth_lib#0' => 2],
        'scores' => ['auth_lib' => 0.5],
        'align' => ['west' => 1],
        'spectrum' => 'tech_reform',
        'consistency' => 0.5,
        'answered' => 1,
        'stats_consent' => true,
    ], $overrides));
}

it('adds later runs to the running compass tally', function () {
    tallyRun(['scores' => ['auth_lib' => 1.0]]);
    expect(inertiaProp($this->get('/compass/stats')->assertOk(), 'stats.total'))->toBe(1);

    // Only this run is read on the second pass; the first is already tallied.
    tallyRun(['scores' => ['auth_lib' => 0.0], 'answers' => ['auth_lib#0' => -2]]);
    Cache::forget(CompassController::PUBLIC_STATS_CACHE_KEY);

    $stats = inertiaProp($this->get('/compass/stats')->assertOk(), 'stats');

    expect($stats['total'])->toBe(2)
        ->and($stats['axisAverages']['all']['auth_lib'])->toEqual(0.5)
        ->and($stats['questions']['auth_lib#0']['all'])->toBe(['n' => 2, 'counts' => [1, 0, 0, 0, 1]]);
});

it('rebuilds the compass tally when a run is withdrawn', function () {
    tallyRun(['scores' => ['auth_lib' => 1.0]]);
    $withdrawn = tallyRun(['scores' => ['auth_lib' => 0.0]]);
    expect(inertiaProp($this->get('/compass/stats'), 'stats.total'))->toBe(2);

    // Removed behind the tally's back, as a withdrawal or a manual delete does.
    $withdrawn->delete();
    Cache::forget(CompassController::PUBLIC_STATS_CACHE_KEY);

    $stats = inertiaProp($this->get('/compass/stats'), 'stats');

    expect($stats['total'])->toBe(1)
        ->and($stats['axisAverages']['all']['auth_lib'])->toEqual(1.0);
});

it('rebuilds the compass tally a day after it was built, however many runs arrive', function () {
    $builtAt = now();
    $corrected = tallyRun(['scores' => ['auth_lib' => 1.0]]);
    expect(inertiaProp($this->get('/compass/stats'), 'stats.axisAverages.all.auth_lib'))->toEqual(1.0);

    // A steady trickle of submissions must not push the rebuild back.
    foreach ([8, 16, 23] as $hours) {
        $this->travelTo($builtAt->copy()->addHours($hours));
        tallyRun(['scores' => ['auth_lib' => 1.0]]);
        Cache::forget(CompassController::PUBLIC_STATS_CACHE_KEY);
        $this->get('/compass/stats')->assertOk();
    }

    // A correction to an existing run: the row count does not change, so only
    // the deadline can pick it up.
    DB::table('compass_results')->where('id', $corrected->id)->update(['scores' => json_encode(['auth_lib' => -1.0])]);

    Cache::forget(CompassController::PUBLIC_STATS_CACHE_KEY);
    expect(inertiaProp($this->get('/compass/stats'), 'stats.axisAverages.all.auth_lib'))->toEqual(1.0);

    // 25 hours after the tally was first built.
    $this->travelTo($builtAt->copy()->addHours(25));
    Cache::forget(CompassController::PUBLIC_STATS_CACHE_KEY);

    // (-1 + 1 + 1 + 1) / 4
    expect(inertiaProp($this->get('/compass/stats'), 'stats.axisAverages.all.auth_lib'))->toEqual(0.5);
});

it('never counts a signed-in or non-consenting run in the tally', function () {
    tallyRun();
    tallyRun(['stats_consent' => false]);
    tallyRun(['user_id' => User::factory()->create()->id]);

    expect(inertiaProp($this->get('/compass/stats'), 'stats.total'))->toBe(1);
});
