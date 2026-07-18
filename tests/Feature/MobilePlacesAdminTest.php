<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\User;
use App\Services\PlaceImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function mobilePlaceAdminToken(User $user, string $name = 'mobile:place-admin-test'): string
{
    return $user->createToken($name, ['mobile'])->plainTextToken;
}

test('place moderation accepts admin sessions and verified mobile admin tokens', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user']);
    $wildcard = $admin->createToken('browser-admin', ['*'])->plainTextToken;

    $this->getJson('/api/v1/admin/places')->assertUnauthorized();
    $this->actingAs($admin)->getJson('/api/v1/admin/places')->assertOk();
    $this->withToken($wildcard)->getJson('/api/v1/admin/places')->assertUnauthorized();
    $this->withToken(mobilePlaceAdminToken($user))->getJson('/api/v1/admin/places')->assertForbidden();
    $this->withToken(mobilePlaceAdminToken($admin))->getJson('/api/v1/admin/places')->assertOk();
});

test('mobile administrators receive the current saves-only moderation shape', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $place = Place::factory()->create();

    $this->withToken(mobilePlaceAdminToken($admin))->getJson('/api/v1/admin/places')
        ->assertOk()
        ->assertJsonPath('data.0.id', $place->id)
        ->assertJsonStructure([
            'data' => [[
                'id',
                'name',
                'category',
                'description',
                'lat',
                'lng',
                'saves_count',
                'status',
                'saved_by_me',
                'photos',
                'user' => ['id', 'name', 'avatar_url'],
            ]],
        ])
        ->assertJsonMissingPath('data.0.likes_count')
        ->assertJsonMissingPath('data.0.comments_count')
        ->assertJsonMissingPath('data.0.reports_count');
});

test('mobile administrators can edit places and manage every photo operation', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['role' => 'admin']);
    $place = Place::factory()->approved()->create();
    $first = app(PlaceImageService::class)->store(
        UploadedFile::fake()->image('first.jpg', 800, 600),
        $place->id,
        0,
    );
    $token = mobilePlaceAdminToken($admin);

    $this->withToken($token)->patchJson("/api/v1/admin/places/{$place->id}", [
        'name' => 'اسم محدث',
    ])->assertOk()->assertJsonPath('name', 'اسم محدث');

    $added = $this->withToken($token)->postJson("/api/v1/admin/places/{$place->id}/photos", [
        'photo' => UploadedFile::fake()->image('added.jpg', 800, 600),
    ])->assertCreated();

    $this->withToken($token)->postJson("/api/v1/admin/place-photos/{$first->id}/rotate")
        ->assertOk()
        ->assertJsonPath('id', $first->id);
    $this->withToken($token)->postJson("/api/v1/admin/place-photos/{$first->id}/replace", [
        'photo' => UploadedFile::fake()->image('replacement.jpg', 600, 900),
    ])->assertOk()->assertJsonPath('id', $first->id);
    $this->withToken($token)->deleteJson('/api/v1/admin/place-photos/'.$added->json('id'))
        ->assertNoContent();

    $this->assertDatabaseHas('places', ['id' => $place->id, 'name' => 'اسم محدث']);
    $this->assertDatabaseMissing('place_photos', ['id' => $added->json('id')]);
});

test('mobile administrators moderate and delete places through the unified controller', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['role' => 'superadmin']);
    $approve = Place::factory()->create();
    $reject = Place::factory()->create();
    $destroy = Place::factory()->approved()->create();
    PlacePhoto::factory()->create(['place_id' => $destroy->id]);
    $token = mobilePlaceAdminToken($admin);

    $this->withToken($token)->postJson("/api/v1/admin/places/{$approve->id}/approve")
        ->assertOk()
        ->assertJsonPath('status', 'approved');
    $this->withToken($token)->postJson("/api/v1/admin/places/{$reject->id}/reject", [
        'reason' => 'صور غير واضحة',
    ])->assertOk()->assertJsonPath('status', 'rejected');
    $this->withToken($token)->deleteJson("/api/v1/admin/places/{$destroy->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('places', ['id' => $destroy->id]);
});
