<?php

use App\Models\Poll;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\User;

test('cannot delete best-ministers poll', function () {
    $poll = Poll::factory()->create(['slug' => 'best-ministers']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->deleteJson("/api/polls/{$poll->id}")
        ->assertStatus(403)
        ->assertJsonPath('message', 'Cannot delete the core Best Ministers poll.');

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
                'features' => []
            ]
        ])
        ->assertStatus(403)
        ->assertJsonPath('message', 'Your account has been banned from submitting route drafts.');
});

test('deleting user account soft deletes user and delegates polls and routes to superadmin', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $admin = User::factory()->create(['role' => 'admin']);

    // Create a poll owned by the deleting admin
    $poll = Poll::factory()->create(['user_id' => $admin->id]);

    \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();

    // Create a route owned by the deleting admin
    $route = Route::create([
        'id' => 'route-damascus-test',
        'city_id' => 'damascus',
        'name_ar' => 'مسار اختبار',
        'status' => 'published',
        'user_id' => $admin->id,
    ]);

    \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

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
