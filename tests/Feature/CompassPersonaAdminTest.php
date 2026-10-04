<?php

use App\Models\CompassPersona;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/*
|--------------------------------------------------------------------------
| Compass persona manager
|--------------------------------------------------------------------------
|
| Personas (spectra) are administered under their own `compass.personas`
| capability. The seeded personas are ENABLED by default, and only enabled
| personas are handed to the compass page.
|
*/

function compassPersonaManager(): User
{
    return User::factory()->create(['role' => 'user', 'permissions' => ['compass.personas']]);
}

it('gates the personas manager behind compass.personas', function () {
    $this->get('/admin/compass/personas')->assertRedirect();
    $this->getJson('/api/v1/admin/compass/personas')->assertUnauthorized();

    $plain = User::factory()->create(['role' => 'user', 'permissions' => []]);
    $this->actingAs($plain)->get('/admin/compass/personas')->assertForbidden();

    $statsOnly = User::factory()->create(['role' => 'user', 'permissions' => ['compass.stats']]);
    $this->actingAs($statsOnly)->postJson('/api/v1/admin/compass/personas', [])->assertForbidden();
});

it('seeds personas enabled by default', function () {
    expect(CompassPersona::count())->toBeGreaterThan(0)
        ->and(CompassPersona::where('enabled', true)->count())->toBe(CompassPersona::count());
});

it('lets a compass.personas holder and the superadmin manage personas', function () {
    $this->actingAs(compassPersonaManager())
        ->get('/admin/compass/personas')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Admin/Compass/Personas')->has('personas'));

    $created = $this->actingAs(compassPersonaManager())
        ->postJson('/api/v1/admin/compass/personas', [
            'name' => 'نمط جديد',
            'icon' => 'Flag',
            'short' => 'وصف',
            'factoid' => 'لمحة',
            'stances' => ['موقف'],
            'enabled' => true,
            'center' => ['auth_lib' => 0.4, 'central_federal' => -0.6],
            'ranges' => ['central_federal' => ['min' => -1, 'max' => -0.3]],
        ])
        ->assertOk()
        ->assertJsonPath('persona.slug', 'nmt-gdyd')
        ->json('persona');

    $this->actingAs(compassPersonaManager())
        ->putJson("/api/v1/admin/compass/personas/{$created['id']}", [
            'name' => 'نمط معدّل',
            'enabled' => false,
            'center' => ['auth_lib' => 0.2],
        ])
        ->assertOk()
        ->assertJsonPath('persona.enabled', false);

    $this->actingAs(compassPersonaManager())
        ->postJson("/api/v1/admin/compass/personas/{$created['id']}/toggle")
        ->assertOk()
        ->assertJsonPath('enabled', true);

    $this->actingAs(compassPersonaManager())
        ->deleteJson("/api/v1/admin/compass/personas/{$created['id']}")
        ->assertOk();

    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $this->actingAs($superadmin)->get('/admin/compass/personas')->assertOk();
});

it('drops blank range rows rather than storing them', function () {
    $created = $this->actingAs(compassPersonaManager())
        ->postJson('/api/v1/admin/compass/personas', [
            'name' => 'نطاقات',
            'center' => [],
            'ranges' => [
                'central_federal' => ['min' => '', 'max' => ''],
                'auth_lib' => ['min' => 0.2, 'max' => ''],
            ],
        ])
        ->assertOk()
        ->json('persona');

    expect($created['ranges'])->toHaveKey('auth_lib')
        ->and($created['ranges'])->not->toHaveKey('central_federal');
});

it('hands only enabled personas to the compass page', function () {
    CompassPersona::query()->update(['enabled' => false]);
    CompassPersona::where('slug', 'tech_reform')->update(['enabled' => true]);

    $this->get('/compass')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Compass/Index')
        ->has('personas', 1)
        ->where('personas.0.id', 'tech_reform')
    );
});
