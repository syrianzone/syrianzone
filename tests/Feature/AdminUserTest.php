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
    $admin = User::factory()->create([
        'avatar_url' => 'https://accounts.example.test/private-admin.png',
        'email' => 'private-admin@example.test',
        'google_id' => 'private-admin-subject',
        'name' => 'Private Admin',
        'role' => 'admin',
    ]);
    $admin->createToken('mobile:admin-device', ['mobile']);

    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->deleteJson("/api/admins/{$admin->id}")
        ->assertOk();

    $this->assertSoftDeleted('users', ['id' => $admin->id]);
    $deletedAdmin = User::withTrashed()->findOrFail($admin->id);
    expect($deletedAdmin->avatar_url)->toBeNull()
        ->and($deletedAdmin->email)->not->toBe('private-admin@example.test')
        ->and($deletedAdmin->email)->toEndWith('@deleted.invalid')
        ->and($deletedAdmin->google_id)->toBeNull()
        ->and($deletedAdmin->name)->not->toBe('Private Admin')
        ->and($admin->tokens()->count())->toBe(0);
});

test('cannot delete superadmin', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->deleteJson("/api/admins/{$superadmin->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $superadmin->id]);
});
