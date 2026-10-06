<?php

use App\Models\CompassResult;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;

/*
|--------------------------------------------------------------------------
| Public compass statistics
|--------------------------------------------------------------------------
|
| A public page of aggregates only: counts, per-length averages and the average
| answer to a single question. It must never expose anything that singles out a
| run (consistency, recent submissions, timestamps), and must count only the
| anonymous runs whose owner consented to statistics.
|
*/

beforeEach(fn () => Cache::flush());

function publicCompassRun(array $overrides = []): CompassResult
{
    static $n = 0;
    $n++;

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

it('is public and renders without authentication', function () {
    $this->get('/compass/stats')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Compass/Stats'));
});

it('counts only anonymous consented runs', function () {
    publicCompassRun();                                  // counted
    publicCompassRun(['stats_consent' => false]);        // withdrawn
    $owner = User::factory()->create();
    publicCompassRun(['user_id' => $owner->id]);         // saved to an account

    $this->get('/compass/stats')->assertInertia(fn (Assert $page) => $page
        ->where('stats.total', 1)
    );
});

it('averages a question and breaks the counts down by length', function () {
    publicCompassRun(['version' => 'short', 'answers' => ['auth_lib#0' => 2]]);
    publicCompassRun(['version' => 'short', 'answers' => ['auth_lib#0' => -2]]);
    publicCompassRun(['version' => 'full', 'answers' => ['auth_lib#0' => 2]]);

    $this->get('/compass/stats')->assertInertia(fn (Assert $page) => $page
        ->where('stats.total', 3)
        ->where('stats.byVersion.short', 2)
        ->where('stats.byVersion.full', 1)
        ->where('stats.questions.auth_lib#0.all.n', 3)
        ->where('stats.questions.auth_lib#0.all.counts.0', 1) // one strongly-disagree
        ->where('stats.questions.auth_lib#0.all.counts.4', 2) // two strongly-agree
        ->where('stats.questions.auth_lib#0.short.n', 2)
    );
});

it('never exposes consistency or recent submissions', function () {
    publicCompassRun();

    $this->get('/compass/stats')->assertInertia(fn (Assert $page) => $page
        ->missing('stats.consistency')
        ->missing('stats.avgConsistency')
        ->missing('stats.recent')
    );
});
