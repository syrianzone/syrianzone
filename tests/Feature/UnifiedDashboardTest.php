<?php

use App\Models\Poll;
use App\Models\Route;
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

    // Satisfy the routes.city_id foreign key; sqlite pragmas cannot be
    // toggled inside the test transaction, so insert a real city instead.
    $geometry = function (array $shape) {
        $json = json_encode($shape, JSON_THROW_ON_ERROR);
        if (\Illuminate\Support\Facades\DB::connection()->getDriverName() === 'sqlite') {
            return $json;
        }

        $quoted = \Illuminate\Support\Facades\DB::connection()->getPdo()->quote($json);

        return \Illuminate\Support\Facades\DB::raw("ST_GeomFromGeoJSON({$quoted})");
    };

    \Illuminate\Support\Facades\DB::table('cities')->insert([
        'id' => 'damascus',
        'name_ar' => 'دمشق',
        'name_en' => 'Damascus',
        'center' => $geometry(['type' => 'Point', 'coordinates' => [36.29, 33.51]]),
        'bounds' => $geometry([
            'type' => 'Polygon',
            'coordinates' => [[[35.8, 33.3], [36.8, 33.3], [36.8, 33.7], [35.8, 33.3]]],
        ]),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
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
