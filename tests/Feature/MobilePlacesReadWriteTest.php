<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\User;
use App\Services\PlaceImageService;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function mobilePlacesToken(User $user, string $name = 'mobile:places-test'): string
{
    return $user->createToken($name, ['mobile'])->plainTextToken;
}

function mobilePlacesUser(array $attributes = []): User
{
    return User::factory()->create(['role' => 'user', ...$attributes]);
}

test('public place reads accept guests and verified mobile identity only', function () {
    $owner = mobilePlacesUser();
    $pending = Place::factory()->create(['user_id' => $owner->id]);
    $wildcard = $owner->createToken('browser-session', ['*'])->plainTextToken;

    $this->getJson('/api/v1/places')->assertOk();
    $this->getJson("/api/v1/places/{$pending->id}")->assertNotFound();
    $this->actingAs($owner)->getJson("/api/v1/places/{$pending->id}")->assertOk();
    $this->withToken(mobilePlacesToken($owner))->getJson("/api/v1/places/{$pending->id}")
        ->assertOk()
        ->assertJsonPath('status', 'pending');
    $this->withToken($wildcard)->getJson('/api/v1/places')->assertUnauthorized();
});

test('place writes accept sessions and verified mobile tokens', function () {
    $user = mobilePlacesUser();
    Place::factory()->approved()->create(['user_id' => $user->id]);

    $this->actingAs($user)->getJson('/api/v1/my/places')
        ->assertOk()
        ->assertJsonCount(1, 'data');
    $this->withToken(mobilePlacesToken($user))->getJson('/api/v1/my/places')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

test('mobile public discovery routes expose geocoding guides and the photo grid', function () {
    config(['services.google_places.key' => null]);
    $owner = mobilePlacesUser();
    $place = Place::factory()->approved()->create([
        'user_id' => $owner->id,
        'name' => 'سوق الحميدية',
        'saves_count' => 4,
    ]);
    PlacePhoto::factory()->create(['place_id' => $place->id, 'sort' => 0]);

    $this->getJson('/api/v1/places/geocode?q=الحميدية')
        ->assertOk()
        ->assertJsonCount(0, 'suggestions');
    $this->getJson('/api/v1/guides?sort=saves')
        ->assertOk()
        ->assertJsonPath('sort', 'saves')
        ->assertJsonPath('guides.0.user_id', $owner->id)
        ->assertJsonPath('guides.0.saves_total', 4);
    $this->getJson('/api/v1/places/photos')
        ->assertOk()
        ->assertJsonPath('data.0.place.id', $place->id)
        ->assertJsonPath('data.0.place.name', 'سوق الحميدية');
});

test('verified mobile owners can manage place content through every native route', function () {
    Storage::fake(config('filesystems.media_disk'));
    $owner = mobilePlacesUser();
    $token = mobilePlacesToken($owner);
    $place = Place::factory()->approved()->create([
        'user_id' => $owner->id,
        'approved_at' => now(),
    ]);
    $existing = app(PlaceImageService::class)->store(
        UploadedFile::fake()->image('existing.jpg', 800, 600),
        $place->id,
        0,
    );

    $this->withToken($token)
        ->patchJson("/api/v1/my/places/{$place->id}", [
            'name' => 'بيت دمشقي مجدد',
            'category' => 'food',
            'description' => 'وصف واضح ومحدث للمكان الدمشقي وتجربته المحلية.',
        ])
        ->assertOk()
        ->assertJsonPath('status', 'pending')
        ->assertJsonPath('category', 'food');

    $this->withToken($token)
        ->patchJson("/api/v1/my/places/{$place->id}/location", [
            'lat' => 33.51234,
            'lng' => 36.29876,
        ])
        ->assertOk()
        ->assertJsonPath('status', 'pending');

    $added = $this->withToken($token)->post("/api/v1/my/places/{$place->id}/photos", [
        'photo' => UploadedFile::fake()->image('added.jpg', 800, 600),
    ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('place_status', 'pending');

    $this->withToken($token)
        ->postJson("/api/v1/my/place-photos/{$existing->id}/rotate")
        ->assertOk()
        ->assertJsonPath('id', $existing->id);
    $this->withToken($token)
        ->deleteJson('/api/v1/my/place-photos/'.$added->json('id'))
        ->assertOk()
        ->assertJsonPath('place_status', 'pending');

    $rejected = Place::factory()->rejected()->create(['user_id' => $owner->id]);
    $this->withToken($token)
        ->postJson("/api/v1/my/places/{$rejected->id}/resubmit")
        ->assertOk()
        ->assertJsonPath('status', 'pending');

    $this->withToken($token)
        ->deleteJson("/api/v1/my/places/{$place->id}")
        ->assertNoContent();
    $this->assertDatabaseMissing('places', ['id' => $place->id]);
});

test('mobile owner management routes reject guests', function () {
    $this->patchJson('/api/v1/my/places/1', ['name' => 'اسم'])->assertUnauthorized();
    $this->patchJson('/api/v1/my/places/1/location', [])->assertUnauthorized();
    $this->postJson('/api/v1/my/places/1/photos')->assertUnauthorized();
    $this->postJson('/api/v1/my/places/1/resubmit')->assertUnauthorized();
    $this->deleteJson('/api/v1/my/places/1')->assertUnauthorized();
    $this->deleteJson('/api/v1/my/place-photos/1')->assertUnauthorized();
    $this->postJson('/api/v1/my/place-photos/1/rotate')->assertUnauthorized();
});

test('place writes reject guests and bearer tokens without mobile provenance', function () {
    $user = mobilePlacesUser();
    $wildcard = $user->createToken('browser-session', ['*'])->plainTextToken;

    $this->postJson('/api/v1/places', [])->assertUnauthorized();
    $this->withToken($wildcard)->postJson('/api/v1/places', [])->assertUnauthorized();
});

test('mobile users submit a bounded image and receive a pending record', function () {
    Storage::fake('public');
    $user = mobilePlacesUser();

    $response = $this->withToken(mobilePlacesToken($user))->post('/api/v1/places', [
        'name' => 'مقهى النوفرة',
        'category' => 'cultural',
        'description' => 'مقهى تاريخي قديم في دمشق القديمة قرب الجامع الأموي',
        'lat' => 33.5104,
        'lng' => 36.2913,
        'photos' => [UploadedFile::fake()->image('damascus.jpg', 1800, 1200)],
    ], ['Accept' => 'application/json']);

    $response->assertCreated()->assertJsonPath('status', 'pending');
    $place = Place::findOrFail($response->json('id'));
    $photo = $place->photos()->firstOrFail();
    expect($place->user_id)->toBe($user->id);
    Storage::disk('public')->assertExists([
        $photo->original_path,
        $photo->display_path,
        $photo->thumb_path,
    ]);
});

test('banned mobile users lose their tokens before place writes', function () {
    $user = mobilePlacesUser(['is_banned' => true]);

    $this->withToken(mobilePlacesToken($user))->postJson('/api/v1/places', [])
        ->assertForbidden()
        ->assertJsonPath('error', 'account_disabled');
    expect($user->tokens()->count())->toBe(0);
});

test('image processing removes new files when photo persistence fails', function () {
    Storage::fake('public');
    $place = Place::factory()->create();
    $existing = PlacePhoto::create([
        'place_id' => $place->id,
        'original_path' => "places/{$place->id}/existing.jpg",
        'display_path' => "places/{$place->id}/existing_display.webp",
        'thumb_path' => "places/{$place->id}/existing_thumb.webp",
        'sort' => 0,
    ]);
    foreach ([$existing->original_path, $existing->display_path, $existing->thumb_path] as $path) {
        Storage::disk('public')->put($path, 'existing');
    }
    $before = Storage::disk('public')->allFiles("places/{$place->id}");

    expect(fn () => app(PlaceImageService::class)->store(
        UploadedFile::fake()->image('duplicate.jpg', 640, 480),
        $place->id,
        0,
    ))->toThrow(QueryException::class);

    expect(Storage::disk('public')->allFiles("places/{$place->id}"))->toBe($before);
});
