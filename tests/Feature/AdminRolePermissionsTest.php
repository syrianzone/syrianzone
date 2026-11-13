<?php

use App\Http\Middleware\AutoLoginDevUser;
use App\Models\PhonebookCategory;
use App\Models\Place;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;

/*
|--------------------------------------------------------------------------
| Admin roles
|--------------------------------------------------------------------------
|
| Covers the two inconsistencies this file exists for:
|
|  1. `phonebook_admin` was a real role in User::hasPermission() but was not in
|     the Filament role select, so it could never be assigned to anyone.
|  2. There was no `places_admin` role at all, so places access depended purely
|     on hand-picked capabilities while every other module had a role.
|
| Plus the invariant that makes those two impossible to reintroduce: the
| Filament select, the dev impersonation list, and the role→module table in
| User must agree with each other, and hasPermission() must agree with
| effectivePermissions() for every role and every capability.
|
*/

test('a places-scoped account holds exactly the places module', function () {
    $user = moduleStaff('places');

    foreach (PermissionCatalogue::forModule('places') as $permission) {
        expect($user->hasPermission($permission))->toBeTrue();
    }

    // And nothing outside it.
    foreach (PermissionCatalogue::all() as $permission) {
        if (str_starts_with($permission, 'places.')) {
            continue;
        }
        expect($user->hasPermission($permission))->toBeFalse();
    }
});

test('a phonebook-scoped account holds exactly the phonebook module', function () {
    $user = moduleStaff('phonebook');

    foreach (PermissionCatalogue::forModule('phonebook') as $permission) {
        expect($user->hasPermission($permission))->toBeTrue();
    }

    foreach (PermissionCatalogue::all() as $permission) {
        if (str_starts_with($permission, 'phonebook.')) {
            continue;
        }
        expect($user->hasPermission($permission))->toBeFalse();
    }
});

test('hasPermission and effectivePermissions agree for every role and capability', function () {
    // The table-driven test is only safe if these two cannot diverge.
    $roles = ['user', 'transit_admin', 'syofficial_admin', 'govapps_admin', 'phonebook_admin', 'places_admin', 'admin', 'superadmin'];

    $grantSets = [
        'none' => [],
        'one' => ['places.review'],
        'wildcard' => ['*'],
    ];

    foreach ($roles as $role) {
        foreach ($grantSets as $label => $grants) {
            $user = User::factory()->create(['role' => $role, 'permissions' => $grants]);

            $resolved = $user->effectivePermissions();
            sort($resolved);

            $expected = array_values(array_filter(
                PermissionCatalogue::all(),
                fn (string $permission) => $user->hasPermission($permission),
            ));
            sort($expected);

            expect($resolved)->toBe($expected, "role={$role} grants={$label}");
        }
    }
});

test('capabilities from two modules combine without implying a third', function () {
    // Both grants are explicit in the stored array and must union, without
    // either implying a third module.
    $user = User::factory()->create([
        'role' => 'user',
        'permissions' => array_merge(
            PermissionCatalogue::forModule('places'),
            ['polls.create'],
        ),
    ]);

    expect($user->hasPermission('places.approve'))->toBeTrue()
        ->and($user->hasPermission('polls.create'))->toBeTrue()
        // polls.delete is in neither source, so holding polls.create must not
        // imply the rest of its module.
        ->and($user->hasPermission('polls.delete'))->toBeFalse();
});

// The role select is asserted once, in CapabilitiesTest.

test('dev impersonation covers every preset in the one table', function () {
    $offered = array_keys(AutoLoginDevUser::DEV_USERS);

    expect($offered)->toEqualCanonicalizing(AutoLoginDevUser::names())
        ->and($offered)->toContain('places_admin', 'phonebook_admin');

    // The switcher renders what the server sends: every preset carries the
    // label and icon key it needs, so the client keeps no second table.
    $presets = AutoLoginDevUser::presets();

    expect($presets)->toHaveCount(count($offered));

    foreach ($presets as $preset) {
        expect($preset['label'])->not->toBe('')
            ->and($preset['icon'])->toBeIn(['user', 'bus', 'settings', 'shield']);
    }
});

test('superadmin still holds every capability', function () {
    // The only remaining role that confers anything by name, and so the whole of
    // role-derived access.
    $user = User::factory()->create(['role' => 'superadmin', 'permissions' => []]);

    foreach (PermissionCatalogue::all() as $permission) {
        expect($user->hasPermission($permission))->toBeTrue();
    }
});

// The full-catalogue shape is covered in CapabilitiesTest; what is worth
// asserting here is that it survives the trip through the shared payload.
test('the shared auth payload carries the capabilities it was given', function () {
    $user = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    expect($user->toAuthPayload()['effective_permissions'])
        ->toHaveCount(count(PermissionCatalogue::all()));
});

test('a places-scoped account passes the places admin middleware', function () {
    $user = moduleStaff('places');
    $place = Place::factory()->create();

    $this->actingAs($user)
        ->postJson("/api/v1/admin/places/{$place->id}/approve")
        ->assertOk();

    expect($place->fresh()->status)->toBe('approved');
});

test('a places-scoped account is refused the other modules', function () {
    $user = moduleStaff('places');

    // POST-only routes: a GET would 405 before the middleware ran, so use a
    // real verb to prove the capability check is what refuses.
    $this->actingAs($user)
        ->postJson('/api/v1/admin/syofficial/categories', ['id' => 'x', 'label_ar' => 'س', 'label_en' => 'x'])
        ->assertForbidden();

    $this->actingAs($user)->getJson('/api/v1/admin/route-drafts')->assertForbidden();
});

test('a phonebook-scoped account passes the phonebook admin middleware', function () {
    $user = moduleStaff('phonebook');

    $this->actingAs($user)
        ->postJson('/api/v1/admin/phonebook/categories', [
            'id' => 'test-cat',
            'label_ar' => 'اختبار',
            'label_en' => 'Test',
        ])
        ->assertRedirect();

    expect(PhonebookCategory::where('id', 'test-cat')->exists())->toBeTrue();
});

test('a phonebook-scoped account is refused places and transit', function () {
    $user = moduleStaff('phonebook');

    $this->actingAs($user)->getJson('/api/v1/admin/places')->assertForbidden();
    $this->actingAs($user)->getJson('/api/v1/admin/route-drafts')->assertForbidden();
});

test('the shared auth payload carries resolved capabilities', function () {
    $user = moduleStaff('places');

    $payload = $user->toAuthPayload();

    // Both payload keys are the stored array, so the payload carries nothing the
    // client could not already read.
    expect($payload['role'])->toBe('user')
        ->and($payload['effective_permissions'])->toBe(PermissionCatalogue::forModule('places'))
        // the raw stored array is still sent for the admin UI's checkboxes
        ->and($payload['permissions'])->toBe(PermissionCatalogue::forModule('places'));
});

test('the page props carry no user for a guest', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page->where('auth.user', null));
});

test('the /user endpoint returns the same payload shape as the page props', function () {
    $user = moduleStaff('transit');

    $this->actingAs($user)
        ->getJson('/user')
        ->assertOk()
        ->assertJsonPath('role', 'user')
        ->assertJsonPath('effective_permissions', PermissionCatalogue::forModule('transit'));
});
