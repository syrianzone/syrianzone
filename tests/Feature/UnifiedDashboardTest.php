<?php

use App\Models\Poll;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;

test('cannot delete best-ministers poll', function () {
    $poll = Poll::factory()->create(['slug' => 'best-ministers']);
    $admin = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    $this->actingAs($admin)
        ->deleteJson("/api/polls/{$poll->id}")
        ->assertStatus(403)
        ->assertJsonPath('message', 'لا يمكن حذف الاستطلاع الأساسي.');

    $this->assertDatabaseHas('polls', ['id' => $poll->id]);
});

test('banned user cannot submit route drafts', function () {
    $bannedUser = User::factory()->create(['role' => 'user', 'is_banned' => true]);

    $this->actingAs($bannedUser)
        ->postJson('/api/v1/studio/routes', [
            'city_id' => 'damascus',
            'name_ar' => 'خط المهاجرين',
            'geojson' => [
                'type' => 'FeatureCollection',
                'features' => [],
            ],
        ])
        ->assertStatus(403)
        ->assertJsonPath('message', 'Your account has been banned from submitting route drafts.');
});

test('deleting user account soft deletes user and delegates polls and routes to superadmin', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $admin = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    // Create a poll owned by the deleting admin
    $poll = Poll::factory()->create(['user_id' => $admin->id]);

    // Satisfy the routes.city_id foreign key; sqlite pragmas cannot be
    // toggled inside the test transaction, so insert a real city instead.
    seedCity('damascus', ['name_ar' => 'دمشق', 'name_en' => 'Damascus']);

    // Create a route owned by the deleting admin
    $route = transitRoute('route-damascus-test', 'damascus', [
        'name_ar' => 'مسار اختبار',
        'user_id' => $admin->id,
    ]);

    // Perform delete account action
    $this->actingAs($admin)
        ->postJson('/api/account/delete')
        ->assertOk();

    // Verify user is soft-deleted
    $this->assertSoftDeleted('users', ['id' => $admin->id]);

    // Verify poll and route are delegated to the superadmin
    $this->assertDatabaseHas('polls', [
        'id' => $poll->id,
        'user_id' => $superadmin->id,
    ]);

    $this->assertDatabaseHas('routes', [
        'id' => $route->id,
        'user_id' => $superadmin->id,
    ]);
});

test('account update rejects a blank name and a malformed email in arabic', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/account/update', [
            'name' => '',
            'email' => 'not-an-email',
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.name.0', 'اكتب الاسم')
        ->assertJsonPath('errors.email.0', 'أدخل بريداً إلكترونياً صالحاً');
});

test('account update rejects an email another account already uses in arabic', function () {
    User::factory()->create(['email' => 'taken@example.com']);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/account/update', [
            'name' => 'اسم جديد',
            'email' => 'taken@example.com',
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.email.0', 'هذا البريد الإلكتروني مستخدم');
});
