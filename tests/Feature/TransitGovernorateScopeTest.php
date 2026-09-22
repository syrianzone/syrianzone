<?php

use App\Filament\Resources\UserResource;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\TransitRouteLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

// ─── Fixtures ──────────────────────────────────────────────────────────────

function scopeCity(string $id, string $nameAr = 'مدينة', string $nameEn = 'City'): void
{
    $geometry = function (array $shape) {
        $json = json_encode($shape, JSON_THROW_ON_ERROR);
        if (DB::connection()->getDriverName() === 'sqlite') {
            return $json;
        }
        $quoted = DB::connection()->getPdo()->quote($json);

        return DB::raw("ST_GeomFromGeoJSON({$quoted})");
    };

    DB::table('cities')->insert([
        'id' => $id,
        'name_ar' => $nameAr,
        'name_en' => $nameEn,
        'center' => $geometry(['type' => 'Point', 'coordinates' => [36.72, 34.73]]),
        'bounds' => $geometry([
            'type' => 'Polygon',
            'coordinates' => [[[36.5, 34.55], [36.95, 34.55], [36.95, 34.95], [36.5, 34.95], [36.5, 34.55]]],
        ]),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

function scopeUser(array $permissions, ?array $transitScope = null, string $role = 'user'): User
{
    return User::factory()->create([
        'role' => $role,
        'permissions' => $permissions,
        'permission_scopes' => $transitScope === null ? null : ['transit' => $transitScope],
    ]);
}

function scopeDraft(string $cityId, array $overrides = []): RouteDraft
{
    return RouteDraft::create(array_merge([
        'user_id' => null,
        'city_id' => $cityId,
        'name_ar' => 'مسودة اختبار',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ], $overrides));
}

function scopeRoute(string $id, string $cityId, array $overrides = []): Route
{
    return Route::create(array_merge([
        'id' => $id,
        'city_id' => $cityId,
        'name_ar' => 'خط اختبار',
        'status' => 'published',
    ], $overrides));
}

// ─── Model scope semantics ─────────────────────────────────────────────────

test('allowedTransitCities is null when unscoped and for superadmin', function () {
    $plain = User::factory()->create(['role' => 'user', 'permissions' => ['transit.approve']]);
    $empty = User::factory()->create(['role' => 'user', 'permission_scopes' => ['transit' => []]]);
    $super = User::factory()->create(['role' => 'superadmin', 'permission_scopes' => ['transit' => ['homs']]]);

    expect($plain->allowedTransitCities())->toBeNull()
        ->and($plain->isTransitScopeRestricted())->toBeFalse()
        ->and($empty->allowedTransitCities())->toBeNull()
        ->and($super->allowedTransitCities())->toBeNull()
        ->and($super->hasPermissionInCity('transit.approve', 'aleppo'))->toBeTrue();
});

test('allowedTransitCities trims and drops blank entries', function () {
    $user = User::factory()->create([
        'permission_scopes' => ['transit' => ['homs', ' homs ', '', 'aleppo']],
    ]);

    expect($user->allowedTransitCities())->toBe(['homs', 'aleppo']);
});

test('hasPermissionInCity gates transit capabilities by governorate', function () {
    $user = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.approve', 'polls.create'],
        'permission_scopes' => ['transit' => ['homs']],
    ]);

    expect($user->hasPermissionInCity('transit.approve', 'homs'))->toBeTrue()
        ->and($user->hasPermissionInCity('transit.approve', 'aleppo'))->toBeFalse()
        ->and($user->hasPermissionInCity('transit.approve', null))->toBeFalse()
        ->and($user->hasPermissionInCity('polls.create', 'aleppo'))->toBeTrue()
        ->and($user->hasPermissionInCity('transit.reject', 'homs'))->toBeFalse();
});

test('transit_admin role capabilities are still restricted by governorate scope', function () {
    $user = User::factory()->create([
        'role' => 'transit_admin',
        'permission_scopes' => ['transit' => ['homs']],
    ]);

    expect($user->hasPermissionInCity('transit.approve', 'homs'))->toBeTrue()
        ->and($user->hasPermissionInCity('transit.approve', 'aleppo'))->toBeFalse();
});

// ─── Admin drafts ──────────────────────────────────────────────────────────

test('scoped transit admin only sees drafts in their governorates', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    scopeDraft('homs');
    scopeDraft('aleppo');

    $this->actingAs(scopeUser(['transit.review_drafts'], ['homs']))
        ->getJson('/api/v1/admin/route-drafts')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.city_id', 'homs');
});

test('unscoped transit admin sees every governorate', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    scopeDraft('homs');
    scopeDraft('aleppo');

    $this->actingAs(User::factory()->create(['role' => 'transit_admin']))
        ->getJson('/api/v1/admin/route-drafts')
        ->assertOk()
        ->assertJsonCount(2);
});

test('scoped transit admin cannot approve or reject drafts outside scope', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    $draft = scopeDraft('aleppo');

    $user = scopeUser(['transit.approve', 'transit.reject'], ['homs']);

    $this->actingAs($user)->postJson("/api/v1/admin/route-drafts/{$draft->id}/approve")->assertForbidden();
    $this->actingAs($user)->postJson("/api/v1/admin/route-drafts/{$draft->id}/reject")->assertForbidden();

    $this->assertDatabaseHas('route_drafts', ['id' => $draft->id, 'status' => 'pending']);
});

test('scoped transit admin can approve and reject inside scope', function () {
    scopeCity('homs');
    $approve = scopeDraft('homs');
    $reject = scopeDraft('homs');

    $user = scopeUser(['transit.approve', 'transit.reject'], ['homs']);

    $this->actingAs($user)->postJson("/api/v1/admin/route-drafts/{$approve->id}/approve")
        ->assertOk();
    $this->assertDatabaseHas('route_drafts', ['id' => $approve->id, 'status' => 'approved']);
    $this->assertDatabaseHas('routes', ['city_id' => 'homs', 'name_ar' => 'مسودة اختبار']);

    $this->actingAs($user)->postJson("/api/v1/admin/route-drafts/{$reject->id}/reject")
        ->assertOk();
    $this->assertDatabaseHas('route_drafts', ['id' => $reject->id, 'status' => 'rejected']);
});

// ─── Admin routes + logs ───────────────────────────────────────────────────

test('scoped transit admin route list and logs are filtered by governorate', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    scopeRoute('route-homs-1', 'homs');
    scopeRoute('route-aleppo-1', 'aleppo');
    TransitRouteLog::create(['route_id' => 'route-homs-1', 'action' => 'approved', 'description' => 'homs']);
    TransitRouteLog::create(['route_id' => 'route-aleppo-1', 'action' => 'approved', 'description' => 'aleppo']);

    $user = scopeUser(['transit.review_drafts'], ['homs']);

    $this->actingAs($user)->getJson('/api/v1/admin/routes')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', 'route-homs-1');

    $this->actingAs($user)->getJson('/api/v1/admin/routes/logs')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.description', 'homs');
});

test('scoped transit admin cannot edit routes outside scope', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    scopeRoute('route-aleppo-1', 'aleppo');

    $user = scopeUser(['transit.edit_routes'], ['homs']);

    $this->actingAs($user)->putJson('/api/v1/admin/routes/route-aleppo-1', ['name_ar' => 'ممنوع'])
        ->assertForbidden();
    $this->actingAs($user)->postJson('/api/v1/admin/routes/route-aleppo-1/status', ['status' => 'hidden'])
        ->assertForbidden();

    $this->assertDatabaseHas('routes', [
        'id' => 'route-aleppo-1',
        'name_ar' => 'خط اختبار',
        'status' => 'published',
    ]);
});

test('scoped transit admin can edit routes inside scope', function () {
    scopeCity('homs');
    scopeRoute('route-homs-1', 'homs');

    $user = scopeUser(['transit.edit_routes'], ['homs']);

    $this->actingAs($user)->putJson('/api/v1/admin/routes/route-homs-1', ['name_ar' => 'خط محدث'])
        ->assertOk();
    $this->actingAs($user)->postJson('/api/v1/admin/routes/route-homs-1/status', ['status' => 'hidden'])
        ->assertOk();

    $this->assertDatabaseHas('routes', [
        'id' => 'route-homs-1',
        'name_ar' => 'خط محدث',
        'status' => 'hidden',
    ]);
});

test('moving a route requires access to both source and target governorates', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    scopeRoute('route-homs-1', 'homs');
    scopeRoute('route-aleppo-1', 'aleppo');

    // Destination outside scope
    $this->actingAs(scopeUser(['transit.edit_routes'], ['homs']))
        ->postJson('/api/v1/admin/routes/route-homs-1/move', ['city_id' => 'aleppo'])
        ->assertForbidden();

    // Source outside scope
    $this->actingAs(scopeUser(['transit.edit_routes'], ['homs']))
        ->postJson('/api/v1/admin/routes/route-aleppo-1/move', ['city_id' => 'homs'])
        ->assertForbidden();

    // Both governorates allowed
    $this->actingAs(scopeUser(['transit.edit_routes'], ['homs', 'aleppo']))
        ->postJson('/api/v1/admin/routes/route-aleppo-1/move', ['city_id' => 'homs'])
        ->assertOk();

    $this->assertDatabaseHas('routes', ['id' => 'route-aleppo-1', 'city_id' => 'homs']);
});

// ─── Delete endpoint ───────────────────────────────────────────────────────

test('deleting a route is scoped by governorate', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    scopeRoute('route-homs-1', 'homs');
    scopeRoute('route-aleppo-1', 'aleppo');

    $user = scopeUser(['transit.delete_routes'], ['homs']);

    $this->actingAs($user)->deleteJson('/api/v1/admin/routes/route-aleppo-1')->assertForbidden();
    $this->assertDatabaseHas('routes', ['id' => 'route-aleppo-1']);

    $this->actingAs($user)->deleteJson('/api/v1/admin/routes/route-homs-1')->assertOk();
    $this->assertDatabaseMissing('routes', ['id' => 'route-homs-1']);
    $this->assertDatabaseHas('transit_route_logs', [
        'route_id' => 'route-homs-1',
        'action' => 'deleted',
    ]);
});

test('deleting a route requires the delete capability', function () {
    scopeCity('homs');
    scopeRoute('route-homs-1', 'homs');

    $this->actingAs(scopeUser(['transit.edit_routes'], ['homs']))
        ->deleteJson('/api/v1/admin/routes/route-homs-1')
        ->assertForbidden();

    $this->assertDatabaseHas('routes', ['id' => 'route-homs-1']);
});

// ─── Import ────────────────────────────────────────────────────────────────

test('scoped staff import preview only shows candidates in their governorates', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    Http::fake(['https://www.google.com/maps/d/kml*' => Http::response(
        file_get_contents(base_path('tests/Fixtures/transit-single.kml')),
        200
    )]);

    $mid = '1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4';

    $this->actingAs(scopeUser(['transit.review_drafts'], ['homs']))
        ->postJson('/api/v1/admin/routes/import-preview', ['mid' => $mid])
        ->assertOk()
        ->assertJsonCount(1, 'routes')
        ->assertJsonPath('routes.0.suggested_city_id', 'homs')
        ->assertJsonPath('scope_filtered', 0);

    $this->actingAs(scopeUser(['transit.review_drafts'], ['aleppo']))
        ->postJson('/api/v1/admin/routes/import-preview', ['mid' => $mid])
        ->assertOk()
        ->assertJsonCount(0, 'routes')
        ->assertJsonPath('scope_filtered', 1);
});

test('scoped staff cannot force an out-of-scope import override', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    Http::fake(['https://www.google.com/maps/d/kml*' => Http::response(
        file_get_contents(base_path('tests/Fixtures/transit-single.kml')),
        200
    )]);

    $this->actingAs(scopeUser(['transit.review_drafts'], ['homs']))
        ->postJson('/api/v1/admin/routes/import-preview', [
            'mid' => '1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4',
            'city_id' => 'aleppo',
        ])
        ->assertForbidden();
});

test('import publish is rejected outside the governorate scope', function () {
    scopeCity('homs');
    scopeCity('aleppo');

    $this->actingAs(scopeUser(['transit.review_drafts'], ['homs']))
        ->postJson('/api/v1/admin/routes/import-publish', [
            'city_id' => 'aleppo',
            'name_ar' => 'خط',
            'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        ])
        ->assertForbidden();
});

// ─── Studio ────────────────────────────────────────────────────────────────

function scopeLineGeojson(): array
{
    return [
        'type' => 'FeatureCollection',
        'features' => [
            [
                'type' => 'Feature',
                'properties' => [],
                'geometry' => [
                    'type' => 'LineString',
                    'coordinates' => [[36.66, 34.73], [36.68, 34.735], [36.71, 34.732]],
                ],
            ],
        ],
    ];
}

test('scoped staff cannot submit studio drafts outside their governorates', function () {
    scopeCity('homs');
    scopeCity('aleppo');

    $payload = [
        'city_id' => 'aleppo',
        'name_ar' => 'خط مجتمعي',
        'geojson' => scopeLineGeojson(),
    ];

    $this->actingAs(scopeUser(['transit.review_drafts'], ['homs']))
        ->postJson('/api/v1/studio/routes', $payload)
        ->assertForbidden();

    $this->actingAs(scopeUser(['transit.review_drafts'], ['homs']))
        ->postJson('/api/v1/studio/routes', array_merge($payload, ['city_id' => 'homs']))
        ->assertCreated();
});

test('studio submissions stay open to anonymous and regular users', function () {
    scopeCity('aleppo');

    $payload = [
        'city_id' => 'aleppo',
        'name_ar' => 'خط مجتمعي',
        'geojson' => scopeLineGeojson(),
    ];

    $this->postJson('/api/v1/studio/routes', $payload)->assertCreated();

    $this->actingAs(User::factory()->create(['role' => 'user', 'permissions' => []]))
        ->postJson('/api/v1/studio/routes', $payload)
        ->assertCreated();
});

test('scoped staff cannot open out-of-scope drafts or routes in studio', function () {
    scopeCity('homs');
    scopeCity('aleppo');

    $user = scopeUser(['transit.review_drafts'], ['homs']);
    $ownDraft = scopeDraft('homs', ['user_id' => $user->id]);
    $outsideDraft = scopeDraft('aleppo');
    $outsideRoute = scopeRoute('route-aleppo-1', 'aleppo');

    $this->actingAs($user)->getJson("/api/v1/studio/routes/{$ownDraft->id}")->assertOk();
    $this->actingAs($user)->getJson("/api/v1/studio/routes/{$outsideDraft->id}")->assertForbidden();
    $this->actingAs($user)->getJson("/api/v1/studio/routes/{$outsideRoute->id}/from-route")->assertForbidden();
});

// ─── Filament form data mapping ────────────────────────────────────────────

test('mergePermissionFormData folds grouped checkboxes and preserves unknown capabilities', function () {
    $merged = UserResource::mergePermissionFormData([
        'permissions' => ['*'],
        'perm_syofficial' => ['syofficial.create'],
        'perm_transit' => ['transit.approve', 'transit.edit_routes'],
        'perm_polls' => [],
        'transit_scope' => ['homs', 'aleppo'],
    ]);

    expect($merged['permissions'])
        ->toContain('syofficial.create', 'transit.approve', 'transit.edit_routes', '*')
        ->not->toContain('polls.create')
        ->and($merged['permission_scopes'])->toBe(['transit' => ['homs', 'aleppo']])
        ->and($merged)->not->toHaveKey('perm_transit')
        ->and($merged)->not->toHaveKey('transit_scope');
});

test('clearing the transit scope keeps other module scopes', function () {
    $merged = UserResource::mergePermissionFormData(
        ['perm_transit' => ['transit.approve'], 'transit_scope' => []],
        ['transit' => ['homs'], 'places' => ['foo']],
    );

    expect($merged['permission_scopes'])->toBe(['places' => ['foo']]);
});

test('splitPermissionFormData maps stored permissions and scope to form state', function () {
    $split = UserResource::splitPermissionFormData([
        'permissions' => ['syofficial.create', 'transit.approve'],
        'permission_scopes' => ['transit' => ['homs']],
    ]);

    expect($split['perm_syofficial'])->toBe(['syofficial.create'])
        ->and($split['perm_transit'])->toBe(['transit.approve'])
        ->and($split['perm_polls'])->toBe([])
        ->and($split['transit_scope'])->toBe(['homs']);
});

test('every permission group has a project icon and matching capability prefix', function () {
    $meta = UserResource::permissionGroupMeta();

    foreach (UserResource::permissionGroups() as $group => $options) {
        expect($meta)->toHaveKey($group)
            ->and(array_keys($options))->not->toBeEmpty();

        foreach (array_keys($options) as $capability) {
            expect($capability)->toStartWith("{$group}.");
        }
    }
});

// ─── Inertia sharing ───────────────────────────────────────────────────────

test('permission scopes are shared with the frontend', function () {
    $user = scopeUser(['transit.approve'], ['homs']);

    $this->actingAs($user)->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.permission_scopes.transit', ['homs'])
            ->where('auth.user.permissions', ['transit.approve'])
        );
});

// ─── Filament form smoke test ──────────────────────────────────────────────

test('filament user form renders grouped permissions with project icons', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.approve'],
        'permission_scopes' => ['transit' => ['homs']],
    ]);

    \Livewire\Livewire::actingAs($superadmin)
        ->test(\App\Filament\Resources\UserResource\Pages\EditUser::class, ['record' => $target->getRouteKey()])
        ->assertOk()
        ->assertSee('الحسابات الرسمية')
        ->assertSee('ترانزيت')
        ->assertSee('نطاق المحافظات')
        ->assertSee('viewBox="0 0 32 32"', false);
});

test('filament panel stays arabic even when the app locale is english', function () {
    app()->setLocale('en');

    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.approve'],
    ]);

    $this->actingAs($superadmin)
        ->get("/superadmin/users/{$target->getRouteKey()}/edit")
        ->assertOk()
        ->assertSee('الصلاحيات التفصيلية')
        ->assertSee('نطاق المحافظات')
        // Filament's own UI translations follow the forced panel locale.
        ->assertSee('حفظ التغييرات')
        ->assertSee('viewBox="0 0 32 32"', false);
});

test('filament user form saves grouped permissions and governorate scope', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create(['role' => 'user']);

    \Livewire\Livewire::actingAs($superadmin)
        ->test(\App\Filament\Resources\UserResource\Pages\EditUser::class, ['record' => $target->getRouteKey()])
        ->fillForm([
            'perm_transit' => ['transit.approve', 'transit.edit_routes'],
            'perm_phonebook' => ['phonebook.create'],
            'transit_scope' => ['homs', 'aleppo'],
        ])
        ->call('save')
        ->assertHasNoFormErrors();

    $target->refresh();

    expect($target->permissions)
        ->toContain('transit.approve', 'transit.edit_routes', 'phonebook.create')
        ->not->toContain('polls.create')
        ->and($target->permission_scopes)->toBe(['transit' => ['homs', 'aleppo']]);
});

test('clearing the governorate scope in the form makes the user unrestricted', function () {
    scopeCity('homs');
    scopeCity('aleppo');
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.approve'],
        'permission_scopes' => ['transit' => ['homs']],
    ]);

    \Livewire\Livewire::actingAs($superadmin)
        ->test(\App\Filament\Resources\UserResource\Pages\EditUser::class, ['record' => $target->getRouteKey()])
        ->fillForm(['transit_scope' => []])
        ->call('save')
        ->assertHasNoFormErrors();

    $target->refresh();

    expect($target->allowedTransitCities())->toBeNull()
        ->and($target->hasPermissionInCity('transit.approve', 'aleppo'))->toBeTrue();
});
