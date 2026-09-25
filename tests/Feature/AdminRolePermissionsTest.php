<?php

use App\Filament\Resources\UserResource;
use App\Http\Middleware\AutoLoginDevUser;
use App\Http\Middleware\HandleInertiaRequests;
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

test('the places_admin role grants exactly the places module', function () {
    $user = User::factory()->create(['role' => 'places_admin', 'permissions' => []]);

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

test('the phonebook_admin role grants exactly the phonebook module', function () {
    $user = User::factory()->create(['role' => 'phonebook_admin', 'permissions' => []]);

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
    // The table-driven refactor is only safe if these two cannot diverge.
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

test('a module role plus an explicit grant elsewhere unions both', function () {
    $user = User::factory()->create([
        'role' => 'places_admin',
        'permissions' => ['polls.create'],
    ]);

    expect($user->hasPermission('places.approve'))->toBeTrue()
        ->and($user->hasPermission('polls.create'))->toBeTrue()
        ->and($user->hasPermission('polls.delete'))->toBeFalse();
});

test('the Filament role select can assign every role the model knows about', function () {
    // Guards the original bug: phonebook_admin existed in User but had no entry
    // in the select, so it was unassignable. Any role the model recognises must
    // be offered here.
    $offered = array_keys(UserResource::roleOptions());

    $recognised = array_merge(
        ['superadmin', 'admin', 'user'],
        array_keys(User::moduleImplyingRoles()),
    );

    expect($offered)->toEqualCanonicalizing($recognised);
});

test('dev impersonation covers every assignable role', function () {
    $offered = array_keys(AutoLoginDevUser::DEV_USERS);

    expect($offered)->toEqualCanonicalizing(AutoLoginDevUser::DEV_ROLES)
        ->and($offered)->toContain('places_admin', 'phonebook_admin');
});

test('the admin role still holds every capability', function () {
    $user = User::factory()->create(['role' => 'admin', 'permissions' => []]);

    foreach (PermissionCatalogue::all() as $permission) {
        expect($user->hasPermission($permission))->toBeTrue();
    }
});

test('the shared auth payload resolves the admin role to everything', function () {
    $user = User::factory()->create(['role' => 'admin', 'permissions' => []]);

    expect(HandleInertiaRequests::userPayload($user)['effective_permissions'])
        ->toHaveCount(count(PermissionCatalogue::all()));
});

test('a places_admin passes the places_admin middleware', function () {
    $user = User::factory()->create(['role' => 'places_admin', 'permissions' => []]);
    $place = Place::factory()->create();

    $this->actingAs($user)
        ->postJson("/api/v1/admin/places/{$place->id}/approve")
        ->assertOk();

    expect($place->fresh()->status)->toBe('approved');
});

test('a places_admin is refused the other modules', function () {
    $user = User::factory()->create(['role' => 'places_admin', 'permissions' => []]);

    // POST-only routes: a GET would 405 before the middleware ran, so use a
    // real verb to prove the capability check is what refuses.
    $this->actingAs($user)
        ->postJson('/api/v1/admin/syofficial/categories', ['id' => 'x', 'label_ar' => 'س', 'label_en' => 'x'])
        ->assertForbidden();

    $this->actingAs($user)->getJson('/api/v1/admin/route-drafts')->assertForbidden();
    $this->actingAs($user)->getJson('/api/admins')->assertForbidden();
});

test('a phonebook_admin passes the phonebook_admin middleware', function () {
    $user = User::factory()->create(['role' => 'phonebook_admin', 'permissions' => []]);

    $this->actingAs($user)
        ->postJson('/api/v1/admin/phonebook/categories', [
            'id' => 'test-cat',
            'label_ar' => 'اختبار',
            'label_en' => 'Test',
        ])
        ->assertRedirect();

    expect(PhonebookCategory::where('id', 'test-cat')->exists())->toBeTrue();
});

test('a phonebook_admin is refused places and transit', function () {
    $user = User::factory()->create(['role' => 'phonebook_admin', 'permissions' => []]);

    $this->actingAs($user)->getJson('/api/v1/admin/places')->assertForbidden();
    $this->actingAs($user)->getJson('/api/v1/admin/route-drafts')->assertForbidden();
});

test('the shared auth payload carries resolved capabilities', function () {
    $user = User::factory()->create(['role' => 'places_admin', 'permissions' => []]);

    $payload = HandleInertiaRequests::userPayload($user);

    expect($payload['role'])->toBe('places_admin')
        ->and($payload['effective_permissions'])->toBe(PermissionCatalogue::forModule('places'))
        // the raw stored array is still sent for the admin UI's checkboxes
        ->and($payload['permissions'])->toBe([]);
});

test('the auth payload is null for a guest', function () {
    expect(HandleInertiaRequests::userPayload(null))->toBeNull();
});

test('the /user endpoint returns the same payload shape as the page props', function () {
    $user = User::factory()->create(['role' => 'transit_admin', 'permissions' => []]);

    $this->actingAs($user)
        ->getJson('/user')
        ->assertOk()
        ->assertJsonPath('role', 'transit_admin')
        ->assertJsonPath('effective_permissions', PermissionCatalogue::forModule('transit'));
});
