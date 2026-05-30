<?php

use App\Models\User;

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

test('superadmin can create admin', function () {
    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->postJson('/api/admins', ['name' => 'New Admin', 'email' => 'admin@test.com'])
        ->assertCreated()
        ->assertJsonPath('email', 'admin@test.com')
        ->assertJsonPath('role', 'admin');
});

test('superadmin can delete admin', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->deleteJson("/api/admins/{$admin->id}")
        ->assertOk();

    $this->assertDatabaseMissing('users', ['id' => $admin->id]);
});

test('cannot delete superadmin', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->deleteJson("/api/admins/{$superadmin->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $superadmin->id]);
});
