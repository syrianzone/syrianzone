<?php

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;

test('superadmin can list admins', function () {
    User::factory()->count(3)->create();

    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->getJson('/api/admins')
        ->assertOk()
        ->assertJsonCount(4);
});

test('non-superadmin cannot list admins', function () {
    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->getJson('/api/admins')
        ->assertForbidden();
});

test('superadmin can create a staff account', function () {
    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->postJson('/api/admins', ['name' => 'New Admin', 'email' => 'admin@test.com'])
        ->assertCreated()
        ->assertJsonPath('email', 'admin@test.com')
        // Phase B: created as a plain `user` carrying explicit capabilities,
        // not as role=admin. The role used to short-circuit every permission
        // check via User::isAdmin(), which made the account unscopable.
        ->assertJsonPath('role', 'user');
});

test('a new staff account gets the whole catalogue explicitly', function () {
    // Parity, not a policy choice: the old `role => 'admin'` grant resolved every
    // capability, so the replacement must too. The operator is expected to trim
    // it afterwards in the Filament user form.
    $response = $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->postJson('/api/admins', ['name' => 'New Admin', 'email' => 'scoped@test.com'])
        ->assertCreated();

    $created = User::where('email', 'scoped@test.com')->firstOrFail();

    expect($created->permissions)->toEqual(PermissionCatalogue::all())
        ->and($created->effectivePermissions())->toEqual(PermissionCatalogue::all())
        // And it is genuinely capability-driven now: clearing the array with the
        // role untouched must leave it with nothing.
        ->and((function () use ($created) {
            $created->update(['permissions' => []]);

            return $created->fresh()->effectivePermissions();
        })())->toBe([]);
});

test('superadmin can delete admin', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->deleteJson("/api/admins/{$admin->id}")
        ->assertOk();

    $this->assertSoftDeleted('users', ['id' => $admin->id]);
});

test('cannot delete superadmin', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->deleteJson("/api/admins/{$superadmin->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $superadmin->id]);
});
