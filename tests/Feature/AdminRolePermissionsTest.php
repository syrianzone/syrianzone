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

test('the phonebook_admin role grants exactly the phonebook module', function () {
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

test('capabilities from two modules combine without implying a third', function () {
    // Was 'a module role plus an explicit grant elsewhere unions both'. The union
    // it asserted was real and still is — it was just two sources of access rather
    // than one. Phase D deleted the role-derived source, so both are now explicit
    // and the "unions" part is a property of the stored array.
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

test('the Filament role select offers exactly the roles that still mean something', function () {
    // This used to assert the select and User::moduleImplyingRoles() agreed,
    // which guarded a real bug: phonebook_admin existed on the model but had no
    // entry in the select, so it was unassignable.
    //
    // The coupling is gone. Phase B dropped the six module roles, phase D
    // deleted the table they were resolved through, and phase G dropped the
    // `admin` alias. Two values remain and this list is the whole vocabulary.
    $offered = array_keys(UserResource::roleOptions());

    expect($offered)->toEqualCanonicalizing(['superadmin', 'user'])
        ->and($offered)->not->toContain(
            'admin',
            'places_admin',
            'phonebook_admin',
            'transit_admin',
            'syofficial_admin',
            'govapps_admin',
            'users_admin',
        );
});

test('no role outside superadmin, admin and user is assignable', function () {
    // The inverse, so a future edit that re-adds a module role to the select
    // fails here rather than shipping an account that depends on a role prefix.
    $assignable = array_keys(UserResource::roleOptions());

    // The retired names are spelled out rather than read from the model, because
    // phase D deleted User::moduleImplyingRoles() along with the prefixes. They
    // are history now, and history is worth pinning by value: a future edit that
    // re-adds any of them to the select must fail here. `admin` joined them in
    // phase G.
    foreach (['syofficial_admin', 'transit_admin', 'govapps_admin', 'phonebook_admin', 'places_admin', 'users_admin'] as $moduleRole) {
        expect($assignable)->not->toContain($moduleRole);
    }
});

test('dev impersonation covers every assignable role', function () {
    $offered = array_keys(AutoLoginDevUser::DEV_USERS);

    expect($offered)->toEqualCanonicalizing(AutoLoginDevUser::DEV_ROLES)
        ->and($offered)->toContain('places_admin', 'phonebook_admin');
});

test('superadmin still holds every capability', function () {
    // The only remaining role that confers anything by name. The `admin` alias
    // that used to sit beside it was retired in phase G, so this is now the
    // whole of role-derived access.
    $user = User::factory()->create(['role' => 'superadmin', 'permissions' => []]);

    foreach (PermissionCatalogue::all() as $permission) {
        expect($user->hasPermission($permission))->toBeTrue();
    }
});

test('the shared auth payload resolves a full catalogue to everything', function () {
    // The shape a formerly-`admin` account is migrated to: a `user` whose stored
    // list is the whole catalogue.
    $user = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    expect(HandleInertiaRequests::userPayload($user)['effective_permissions'])
        ->toHaveCount(count(PermissionCatalogue::all()));
});

test('a places_admin passes the places_admin middleware', function () {
    $user = moduleStaff('places');
    $place = Place::factory()->create();

    $this->actingAs($user)
        ->postJson("/api/v1/admin/places/{$place->id}/approve")
        ->assertOk();

    expect($place->fresh()->status)->toBe('approved');
});

test('a places_admin is refused the other modules', function () {
    $user = moduleStaff('places');

    // POST-only routes: a GET would 405 before the middleware ran, so use a
    // real verb to prove the capability check is what refuses.
    $this->actingAs($user)
        ->postJson('/api/v1/admin/syofficial/categories', ['id' => 'x', 'label_ar' => 'س', 'label_en' => 'x'])
        ->assertForbidden();

    $this->actingAs($user)->getJson('/api/v1/admin/route-drafts')->assertForbidden();
    $this->actingAs($user)->getJson('/api/admins')->assertForbidden();
});

test('a phonebook_admin passes the phonebook_admin middleware', function () {
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

test('a phonebook_admin is refused places and transit', function () {
    $user = moduleStaff('phonebook');

    $this->actingAs($user)->getJson('/api/v1/admin/places')->assertForbidden();
    $this->actingAs($user)->getJson('/api/v1/admin/route-drafts')->assertForbidden();
});

test('the shared auth payload carries resolved capabilities', function () {
    $user = moduleStaff('places');

    $payload = HandleInertiaRequests::userPayload($user);

    // effective_permissions used to be derived from a `places_admin` role while
    // `permissions` was empty. Both are now the stored array, so the payload no
    // longer tells the client anything the client could not already read — which
    // is the point of the migration.
    expect($payload['role'])->toBe('user')
        ->and($payload['effective_permissions'])->toBe(PermissionCatalogue::forModule('places'))
        // the raw stored array is still sent for the admin UI's checkboxes
        ->and($payload['permissions'])->toBe(PermissionCatalogue::forModule('places'));
});

test('the auth payload is null for a guest', function () {
    expect(HandleInertiaRequests::userPayload(null))->toBeNull();
});

test('the /user endpoint returns the same payload shape as the page props', function () {
    $user = moduleStaff('transit');

    $this->actingAs($user)
        ->getJson('/user')
        ->assertOk()
        ->assertJsonPath('role', 'user')
        ->assertJsonPath('effective_permissions', PermissionCatalogue::forModule('transit'));
});
