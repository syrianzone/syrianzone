<?php

use App\Models\CompassResult;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Inertia\Testing\AssertableInertia as Assert;

/*
|--------------------------------------------------------------------------
| Compass admin (anonymous statistics)
|--------------------------------------------------------------------------
|
| The section is gated on the `compass.stats` capability through
| CompassAdmin / ModuleCapabilityGuard, so a superadmin gets it by default
| (superadmin resolves the whole catalogue) and any other account needs the
| explicit grant ticked in the Filament user form.
|
| The numbers must only ever describe rows the test taker opted into sharing:
| an account-saved run and a withdrawn anonymous run are both excluded.
|
*/

function compassStatsHolder(): User
{
    return User::factory()->create([
        'role' => 'user',
        'permissions' => PermissionCatalogue::forModule('compass'),
    ]);
}

function anonymousCompassRun(array $overrides = []): CompassResult
{
    return CompassResult::create(array_merge([
        'user_id' => null,
        'version' => 'short',
        'answers' => ['auth_lib#0' => 2],
        'scores' => ['auth_lib' => 0.5],
        'align' => ['west' => 2],
        'spectrum' => 'tech_reform',
        'consistency' => 0.5,
        'answered' => 1,
        'stats_consent' => true,
    ], $overrides));
}

it('redirects guests and forbids accounts without the capability', function () {
    $this->get('/admin/compass')->assertRedirect();

    $plain = User::factory()->create(['role' => 'user', 'permissions' => []]);
    $this->actingAs($plain)->get('/admin/compass')->assertForbidden();
});

it('lets a capability holder and the superadmin in, and renders the stats', function () {
    anonymousCompassRun();

    $this->actingAs(compassStatsHolder())
        ->get('/admin/compass')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Compass/Index')
            ->where('stats.total', 1)
            // Per-scope persona distribution, axis averages and question counts
            // are now shared with the public page.
            ->where('stats.bySpectrum.all.0.id', 'tech_reform')
            ->where('stats.bySpectrum.short.0.id', 'tech_reform')
            ->where('stats.axisAverages.all.auth_lib', 0.5)
            ->where('stats.axisAverages.short.auth_lib', 0.5)
            ->where('stats.questions.auth_lib#0.all.n', 1)
            ->where('stats.questions.auth_lib#0.all.counts.4', 1)
        );

    // Superadmin resolves the whole catalogue, so no explicit grant is needed.
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $this->actingAs($superadmin)->get('/admin/compass')->assertOk();
});

it('counts only anonymous rows that consented', function () {
    anonymousCompassRun();                            // counted
    anonymousCompassRun(['stats_consent' => false]);  // withdrawn on purpose

    $owner = User::factory()->create();
    anonymousCompassRun(['user_id' => $owner->id]);   // saved to an account, not stats

    $this->actingAs(compassStatsHolder())
        ->get('/admin/compass')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Compass/Index')
            ->where('stats.total', 1)
            ->where('stats.byVersion.short', 1)
        );
});
