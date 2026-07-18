<?php

use App\Models\Place;
use App\Models\PlaceComment;
use App\Models\PlaceLike;
use App\Models\PlacePhoto;
use App\Models\PlaceReport;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => Cache::flush());

function mobilePlaceAdminToken(User $user, string $name = 'mobile:place-admin-test'): string
{
    return $user->createToken($name, ['mobile'])->plainTextToken;
}

test('place moderation requires mobile provenance and an administrator role', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user']);
    $wildcard = $admin->createToken('browser-admin', ['*'])->plainTextToken;

    $this->getJson('/api/v1/admin/places')->assertUnauthorized();
    $this->actingAs($admin)->getJson('/api/v1/admin/places')->assertUnauthorized();
    $this->withToken($wildcard)->getJson('/api/v1/admin/places')->assertUnauthorized();
    $this->withToken(mobilePlaceAdminToken($user))->getJson('/api/v1/admin/places')->assertForbidden();
    $this->withToken(mobilePlaceAdminToken($admin))->getJson('/api/v1/admin/places')->assertOk();
});

test('administrators list and filter places with the exact moderation shape', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $pending = Place::factory()->create();
    $approved = Place::factory()->approved()->create();
    Place::factory()->rejected()->create();
    PlaceReport::create([
        'place_id' => $pending->id,
        'user_id' => User::factory()->create(['role' => 'user'])->id,
        'reason' => 'spam',
    ]);
    $token = mobilePlaceAdminToken($admin);

    $this->withToken($token)->getJson('/api/v1/admin/places')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $pending->id)
        ->assertJsonPath('data.0.reports_count', 1)
        ->assertJsonStructure([
            'data' => [[
                'id',
                'name',
                'status',
                'rejection_reason',
                'reports_count',
                'liked_by_me',
                'saved_by_me',
                'photos',
                'user' => ['id', 'name', 'avatar_url'],
            ]],
            'current_page',
            'last_page',
            'total',
        ]);
    $this->withToken($token)->getJson('/api/v1/admin/places?status=approved')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $approved->id);
    $this->withToken($token)->getJson('/api/v1/admin/places?status=all')
        ->assertOk()
        ->assertJsonCount(3, 'data');
    $this->withToken($token)->getJson('/api/v1/admin/places?status=unknown')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});

test('administrators approve pending places and invalidate the public map cache', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);
    $place = Place::factory()->create();
    $token = mobilePlaceAdminToken($admin);

    $this->getJson('/api/v1/places/map')->assertOk()->assertJsonCount(0, 'features');
    expect(Cache::has('places:map'))->toBeTrue();

    $this->withToken($token)->postJson("/api/v1/admin/places/{$place->id}/approve")
        ->assertOk()
        ->assertExactJson(['id' => $place->id, 'status' => 'approved']);
    expect($place->fresh()->approved_at)->not->toBeNull();

    $this->getJson('/api/v1/places/map')
        ->assertOk()
        ->assertJsonCount(1, 'features')
        ->assertJsonPath('features.0.properties.id', $place->id);
    $this->withToken($token)->postJson("/api/v1/admin/places/{$place->id}/approve")
        ->assertStatus(400)
        ->assertJsonPath('message', 'Place is already approved');
});

test('administrators reject only pending places with a bounded reason', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $place = Place::factory()->create();
    $token = mobilePlaceAdminToken($admin);

    $this->withToken($token)->postJson("/api/v1/admin/places/{$place->id}/reject", [
        'reason' => 'صور غير واضحة',
    ])->assertOk()->assertExactJson(['id' => $place->id, 'status' => 'rejected']);
    $this->assertDatabaseHas('places', [
        'id' => $place->id,
        'status' => 'rejected',
        'rejection_reason' => 'صور غير واضحة',
    ]);

    $this->withToken($token)->postJson("/api/v1/admin/places/{$place->id}/reject")
        ->assertStatus(400)
        ->assertJsonPath('message', 'Place is already rejected');
});

test('administrator deletion removes scoped files and every dependent record', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['role' => 'admin']);
    $reporter = User::factory()->create(['role' => 'user']);
    $place = Place::factory()->approved()->create();
    $photo = PlacePhoto::create([
        'place_id' => $place->id,
        'original_path' => "places/{$place->id}/one.jpg",
        'display_path' => "places/{$place->id}/one_display.webp",
        'thumb_path' => "places/{$place->id}/one_thumb.webp",
        'sort' => 0,
    ]);
    PlaceLike::create(['place_id' => $place->id, 'user_id' => $reporter->id]);
    PlaceComment::create(['place_id' => $place->id, 'user_id' => $reporter->id, 'body' => 'تعليق']);
    PlaceReport::create(['place_id' => $place->id, 'user_id' => $reporter->id, 'reason' => 'spam']);
    foreach ([$photo->original_path, $photo->display_path, $photo->thumb_path] as $path) {
        Storage::disk('public')->put($path, 'image');
    }

    $this->withToken(mobilePlaceAdminToken($admin))
        ->deleteJson("/api/v1/admin/places/{$place->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('places', ['id' => $place->id]);
    $this->assertDatabaseMissing('place_photos', ['id' => $photo->id]);
    $this->assertDatabaseCount('place_likes', 0);
    $this->assertDatabaseCount('place_comments', 0);
    $this->assertDatabaseCount('place_reports', 0);
    Storage::disk('public')->assertMissing("places/{$place->id}");
});

test('administrators filter and resolve reports with the native report shape', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $place = Place::factory()->approved()->create();
    $open = PlaceReport::create([
        'place_id' => $place->id,
        'user_id' => User::factory()->create(['role' => 'user'])->id,
        'reason' => 'spam',
    ]);
    PlaceReport::create([
        'place_id' => $place->id,
        'user_id' => User::factory()->create(['role' => 'user'])->id,
        'reason' => 'other',
        'status' => 'resolved',
    ]);
    $token = mobilePlaceAdminToken($admin);

    $this->withToken($token)->getJson('/api/v1/admin/place-reports')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $open->id)
        ->assertJsonStructure([
            'data' => [[
                'id',
                'reason',
                'details',
                'status',
                'created_at',
                'user' => ['id', 'name'],
                'place' => ['id', 'name', 'status'],
            ]],
        ]);
    $this->withToken($token)->getJson('/api/v1/admin/place-reports?status=all')
        ->assertOk()
        ->assertJsonCount(2, 'data');

    $this->withToken($token)->postJson("/api/v1/admin/place-reports/{$open->id}/resolve", [
        'action' => 'resolve',
    ])->assertOk()->assertExactJson(['id' => $open->id, 'status' => 'resolved']);
    $this->withToken($token)->postJson("/api/v1/admin/place-reports/{$open->id}/resolve", [
        'action' => 'dismiss',
    ])->assertOk()->assertExactJson(['id' => $open->id, 'status' => 'dismissed']);
    $this->withToken($token)->postJson("/api/v1/admin/place-reports/{$open->id}/resolve", [
        'action' => 'invalid',
    ])->assertUnprocessable()->assertJsonValidationErrors('action');
});
