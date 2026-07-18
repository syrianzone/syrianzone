<?php

use App\Models\Poll;
use App\Models\Route;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

function seedAdminUserDeletionCity(): void
{
    $point = json_encode(['type' => 'Point', 'coordinates' => [36.29, 33.51]], JSON_THROW_ON_ERROR);
    $bounds = json_encode([
        'type' => 'Polygon',
        'coordinates' => [[[35.8, 33.3], [36.8, 33.3], [36.8, 33.7], [35.8, 33.3]]],
    ], JSON_THROW_ON_ERROR);

    DB::table('cities')->insert([
        'id' => 'admin-delete-city',
        'name_ar' => 'مدينة الحذف',
        'name_en' => 'Deletion City',
        'center' => DB::connection()->getDriverName() === 'sqlite'
            ? $point
            : DB::raw('ST_GeomFromGeoJSON('.DB::connection()->getPdo()->quote($point).')'),
        'bounds' => DB::connection()->getDriverName() === 'sqlite'
            ? $bounds
            : DB::raw('ST_GeomFromGeoJSON('.DB::connection()->getPdo()->quote($bounds).')'),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

function adminDeletionRoute(User $owner): Route
{
    seedAdminUserDeletionCity();

    return Route::create([
        'id' => 'admin-delete-route',
        'city_id' => 'admin-delete-city',
        'name_ar' => 'مسار الحذف',
        'status' => 'published',
        'user_id' => $owner->id,
    ]);
}

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
    Storage::fake('public');
    $admin = User::factory()->create([
        'email' => 'private-admin@example.test',
        'google_id' => 'private-admin-subject',
        'name' => 'Private Admin',
        'role' => 'admin',
    ]);
    $avatarPath = "avatars/{$admin->id}/private-admin.webp";
    Storage::disk('public')->put($avatarPath, 'private avatar');
    $admin->forceFill(['avatar_url' => Storage::disk('public')->url($avatarPath)])->save();
    $admin->createToken('mobile:admin-device', ['mobile']);
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $poll = Poll::factory()->create(['user_id' => $admin->id]);
    $route = adminDeletionRoute($admin);

    $this->actingAs($superadmin)
        ->deleteJson("/api/admins/{$admin->id}")
        ->assertOk();

    $this->assertSoftDeleted('users', ['id' => $admin->id]);
    $deletedAdmin = User::withTrashed()->findOrFail($admin->id);
    expect($deletedAdmin->avatar_url)->toBeNull()
        ->and($deletedAdmin->email)->not->toBe('private-admin@example.test')
        ->and($deletedAdmin->email)->toEndWith('@deleted.invalid')
        ->and($deletedAdmin->google_id)->toBeNull()
        ->and($deletedAdmin->name)->not->toBe('Private Admin')
        ->and($admin->tokens()->count())->toBe(0)
        ->and($poll->fresh()->user_id)->toBe($superadmin->id)
        ->and($route->fresh()->user_id)->toBe($superadmin->id);
    Storage::disk('public')->assertMissing($avatarPath);
});

test('cannot delete the final active superadmin', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($superadmin)
        ->deleteJson("/api/admins/{$superadmin->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $superadmin->id]);
});

test('superadmin deletion transfers ownership when another active superadmin remains', function () {
    $actor = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create(['role' => 'superadmin']);
    $poll = Poll::factory()->create(['user_id' => $target->id]);
    $route = adminDeletionRoute($target);

    $this->actingAs($actor)
        ->deleteJson("/api/admins/{$target->id}")
        ->assertOk();

    expect($target->fresh()->deleted_at)->not->toBeNull()
        ->and($poll->fresh()->user_id)->toBe($actor->id)
        ->and($route->fresh()->user_id)->toBe($actor->id);
});
