<?php

use App\Models\CompassFigure;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Inertia\Testing\AssertableInertia as Assert;

/*
|--------------------------------------------------------------------------
| Compass figure manager
|--------------------------------------------------------------------------
|
| The roster is admin-managed and gated on its own `compass.figures`
| capability, separate from `compass.stats`, so an operator can be allowed to
| read the statistics without being able to change who the compass matches.
| Superadmins resolve the whole catalogue and therefore get it by default.
|
*/

function compassFigureManager(): User
{
    return User::factory()->create(['role' => 'user', 'permissions' => ['compass.figures']]);
}

function makeCompassFigure(array $overrides = []): CompassFigure
{
    static $n = 0;
    $n++;

    return CompassFigure::create(array_merge([
        'name' => "شخصية اختبار {$n}",
        'category' => 'civ',
        'align' => 'neutral',
        'positions' => ['auth_lib' => 0.5],
        'enabled' => false,
        'sort_order' => $n,
    ], $overrides));
}

it('gates the figures manager behind compass.figures', function () {
    $this->get('/admin/compass/figures')->assertRedirect();               // guest page
    $this->getJson('/api/v1/admin/compass/figures')->assertUnauthorized(); // guest api

    $plain = User::factory()->create(['role' => 'user', 'permissions' => []]);
    $this->actingAs($plain)->get('/admin/compass/figures')->assertForbidden();
    $this->actingAs($plain)->getJson('/api/v1/admin/compass/figures')->assertForbidden();

    // Reading the stats is not enough to manage the roster.
    $statsOnly = User::factory()->create(['role' => 'user', 'permissions' => ['compass.stats']]);
    $this->actingAs($statsOnly)->get('/admin/compass/figures')->assertForbidden();
    $this->actingAs($statsOnly)->postJson('/api/v1/admin/compass/figures', [])->assertForbidden();
});

it('lets a compass.figures holder and the superadmin manage the roster', function () {
    $figure = makeCompassFigure();

    $this->actingAs(compassFigureManager())
        ->getJson('/api/v1/admin/compass/figures')
        ->assertOk()
        ->assertJsonStructure(['success', 'figures']);

    $this->actingAs(compassFigureManager())
        ->postJson('/api/v1/admin/compass/figures', [
            'name' => 'شخصية جديدة',
            'category' => 'civ',
            'align' => 'west',
            'enabled' => true,
            'positions' => ['auth_lib' => 0.3, 'rel_sec' => -0.2],
        ])
        ->assertOk()
        ->assertJsonPath('figure.enabled', true);

    $this->actingAs(compassFigureManager())
        ->putJson("/api/v1/admin/compass/figures/{$figure->id}", [
            'name' => $figure->name,
            'category' => 'civ',
            'align' => 'neutral',
            'enabled' => true,
            'positions' => ['auth_lib' => 0.9],
        ])
        ->assertOk()
        ->assertJsonPath('figure.enabled', true);

    $this->actingAs(compassFigureManager())
        ->postJson("/api/v1/admin/compass/figures/{$figure->id}/toggle")
        ->assertOk()
        ->assertJsonPath('enabled', false);

    $this->actingAs(compassFigureManager())
        ->deleteJson("/api/v1/admin/compass/figures/{$figure->id}")
        ->assertOk();

    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $this->actingAs($superadmin)->get('/admin/compass/figures')->assertOk();
});

it('only hands enabled figures to the compass page', function () {
    makeCompassFigure(['name' => 'مفعّلة', 'enabled' => true]);
    makeCompassFigure(['name' => 'معطّلة', 'enabled' => false]);

    $this->get('/compass')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Compass/Index')
        ->has('figures', 1)
        ->where('figures.0.name', 'مفعّلة')
    );
});

it('rejects an unknown category', function () {
    $this->actingAs(compassFigureManager())
        ->postJson('/api/v1/admin/compass/figures', [
            'name' => 'سيئة',
            'category' => 'not-a-category',
            'positions' => [],
        ])
        ->assertStatus(422);
});
