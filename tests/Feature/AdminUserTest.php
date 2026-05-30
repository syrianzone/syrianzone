<?php

use App\Models\User;

test('authenticated user can list admins', function () {
    User::factory()->count(3)->create();

    $this->actingAs(User::factory()->create())
        ->getJson('/admins')
        ->assertOk()
        ->assertJsonCount(4);
});

test('authenticated user can create admin', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/admins', ['name' => 'New Admin', 'email' => 'admin@test.com'])
        ->assertCreated()
        ->assertJsonPath('email', 'admin@test.com')
        ->assertJsonPath('role', 'admin');
});

test('authenticated user can delete admin', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs(User::factory()->create())
        ->deleteJson("/admins/{$admin->id}")
        ->assertOk();

    $this->assertDatabaseMissing('users', ['id' => $admin->id]);
});

test('cannot delete superadmin', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs(User::factory()->create())
        ->deleteJson("/admins/{$superadmin->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $superadmin->id]);
});
