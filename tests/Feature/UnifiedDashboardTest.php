<?php

use App\Models\Poll;
use App\Models\Route;
use App\Models\User;
use Illuminate\Support\Facades\DB;

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
                'features' => [],
            ],
        ])
        ->assertStatus(403)
        ->assertJsonPath('message', 'Your account has been banned from submitting route drafts.');
});

test('deleting user account soft deletes user and delegates polls and routes to superadmin', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $admin = User::factory()->create([
        'avatar_url' => 'https://accounts.example.test/private-dashboard.png',
        'email' => 'private-dashboard@example.test',
        'google_id' => 'private-dashboard-subject',
        'name' => 'Private Dashboard User',
        'role' => 'admin',
    ]);
    $admin->createToken('mobile:dashboard-device', ['mobile']);

    // Create a poll owned by the deleting admin
    $poll = Poll::factory()->create(['user_id' => $admin->id]);

    DB::table('cities')->insert([
        'bounds' => json_encode([
            'coordinates' => [[[35.8, 33.3], [36.8, 33.3], [36.8, 33.7], [35.8, 33.3]]],
            'type' => 'Polygon',
        ], JSON_THROW_ON_ERROR),
        'center' => json_encode([
            'coordinates' => [36.29, 33.51],
            'type' => 'Point',
        ], JSON_THROW_ON_ERROR),
        'created_at' => now(),
        'id' => 'damascus',
        'name_ar' => 'دمشق',
        'name_en' => 'Damascus',
        'status' => 'active',
        'updated_at' => now(),
        'zoom' => 12,
    ]);

    // Create a route owned by the deleting admin
    $route = Route::create([
        'id' => 'route-damascus-test',
        'city_id' => 'damascus',
        'name_ar' => 'مسار اختبار',
        'status' => 'published',
        'user_id' => $admin->id,
    ]);

    // Perform delete account action
    $this->actingAs($admin)
        ->postJson('/api/account/delete')
        ->assertOk();

    // Verify user is soft-deleted
    $this->assertSoftDeleted('users', ['id' => $admin->id]);
    $deletedAdmin = User::withTrashed()->findOrFail($admin->id);
    expect($deletedAdmin->avatar_url)->toBeNull()
        ->and($deletedAdmin->email)->not->toBe('private-dashboard@example.test')
        ->and($deletedAdmin->email)->toEndWith('@deleted.invalid')
        ->and($deletedAdmin->google_id)->toBeNull()
        ->and($deletedAdmin->name)->not->toBe('Private Dashboard User')
        ->and($admin->tokens()->count())->toBe(0);

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

test('the last active superadmin cannot delete their dashboard account', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($superadmin)
        ->postJson('/api/account/delete')
        ->assertConflict()
        ->assertExactJson([
            'code' => 'last_superadmin',
            'message' => 'لا يمكن حذف آخر مشرف عام.',
        ]);

    expect($superadmin->fresh()->deleted_at)->toBeNull();
});
