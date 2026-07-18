<?php

use App\Models\Place;
use App\Models\PlaceLike;
use App\Models\PlacePhoto;
use App\Models\PlaceSave;
use App\Models\User;
use App\Services\PlaceImageService;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => Cache::flush());

function mobilePlacesToken(User $user, string $name = 'mobile:places-test'): string
{
    return $user->createToken($name, ['mobile'])->plainTextToken;
}

function placesRegularUser(array $attributes = []): User
{
    return User::factory()->create(['role' => 'user', ...$attributes]);
}

test('place map returns approved records as cacheable GeoJSON', function () {
    $approved = Place::factory()->approved()->create([
        'lat' => 33.5104,
        'lng' => 36.2913,
    ]);
    PlacePhoto::create([
        'place_id' => $approved->id,
        'original_path' => "places/{$approved->id}/one.jpg",
        'display_path' => "places/{$approved->id}/one_display.webp",
        'thumb_path' => "places/{$approved->id}/one_thumb.webp",
        'sort' => 0,
    ]);
    Place::factory()->create();

    $this->getJson('/api/v1/places/map')
        ->assertOk()
        ->assertHeader('Cache-Control', 'max-age=60, public')
        ->assertExactJson([
            'type' => 'FeatureCollection',
            'features' => [[
                'type' => 'Feature',
                'geometry' => [
                    'type' => 'Point',
                    'coordinates' => [36.2913, 33.5104],
                ],
                'properties' => [
                    'id' => $approved->id,
                    'name' => $approved->name,
                    'category' => $approved->category,
                    'thumb_url' => Storage::disk('public')->url("places/{$approved->id}/one_thumb.webp"),
                ],
            ]],
        ]);

    expect(Cache::has('places:map'))->toBeTrue();
});

test('place catalog validates filters and returns the native list shape', function () {
    Place::factory()->approved()->create([
        'category' => 'natural',
        'likes_count' => 2,
        'name' => 'نوفرة صغيرة',
    ]);
    $popular = Place::factory()->approved()->create([
        'category' => 'cultural',
        'description' => 'مكان قريب من النوفرة القديمة في دمشق',
        'likes_count' => 10,
    ]);
    Place::factory()->approved()->create(['category' => 'cultural', 'likes_count' => 1]);
    Place::factory()->rejected()->create(['category' => 'cultural', 'likes_count' => 100]);

    $this->getJson('/api/v1/places?category=cultural&q='.urlencode('النوفرة').'&sort=popular')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $popular->id)
        ->assertJsonStructure([
            'data' => [[
                'id',
                'name',
                'category',
                'description',
                'lat',
                'lng',
                'thumb_url',
                'likes_count',
                'saves_count',
                'comments_count',
            ]],
            'current_page',
            'last_page',
            'total',
        ]);

    $this->getJson('/api/v1/places?category=unknown')->assertUnprocessable();
    $this->getJson('/api/v1/places?page=0')->assertUnprocessable();
});

test('nearby keeps unpublished records private to their owner and administrators', function () {
    $owner = placesRegularUser();
    $stranger = placesRegularUser();
    $admin = User::factory()->create(['role' => 'admin']);
    $approved = Place::factory()->approved()->create(['lat' => 33.5104, 'lng' => 36.2913]);
    $ownedPending = Place::factory()->create([
        'user_id' => $owner->id,
        'lat' => 33.5105,
        'lng' => 36.2913,
    ]);
    $otherPending = Place::factory()->create([
        'user_id' => $stranger->id,
        'lat' => 33.5106,
        'lng' => 36.2913,
    ]);
    Place::factory()->approved()->create(['lat' => 36.2, 'lng' => 37.2]);
    $url = '/api/v1/places/nearby?lat=33.5104&lng=36.2913&radius_km=1&include_pending=true';

    $guest = $this->getJson($url)->assertOk()->json('places');
    expect(collect($guest)->pluck('id')->all())->toBe([$approved->id]);

    $sessionOnly = $this->actingAs($owner)->getJson($url)->assertOk()->json('places');
    expect(collect($sessionOnly)->pluck('id')->all())->toBe([$approved->id]);

    $owned = $this->withToken(mobilePlacesToken($owner))->getJson($url)->assertOk()->json('places');
    expect(collect($owned)->pluck('id')->all())
        ->toContain($approved->id, $ownedPending->id)
        ->not->toContain($otherPending->id);

    $all = $this->withToken(mobilePlacesToken($admin))->getJson($url)->assertOk()->json('places');
    expect(collect($all)->pluck('id')->all())
        ->toContain($approved->id, $ownedPending->id, $otherPending->id);
    expect($all[0])->toHaveKeys(['distance_m', 'thumb_url', 'likes_count', 'saves_count', 'comments_count']);
});

test('place detail accepts only verified mobile identity for private and personal fields', function () {
    $owner = placesRegularUser();
    $stranger = placesRegularUser();
    $approved = Place::factory()->approved()->create(['user_id' => $owner->id]);
    $pending = Place::factory()->create(['user_id' => $owner->id]);
    PlaceLike::create(['place_id' => $approved->id, 'user_id' => $owner->id]);
    PlaceSave::create(['place_id' => $approved->id, 'user_id' => $owner->id]);

    $this->getJson("/api/v1/places/{$approved->id}")
        ->assertOk()
        ->assertJsonPath('liked_by_me', false)
        ->assertJsonPath('saved_by_me', false)
        ->assertJsonStructure([
            'id',
            'status',
            'created_at',
            'photos',
            'user' => ['id', 'name', 'avatar_url'],
        ]);

    $this->actingAs($owner)->getJson("/api/v1/places/{$pending->id}")->assertNotFound();
    $this->withToken(mobilePlacesToken($stranger))->getJson("/api/v1/places/{$pending->id}")->assertNotFound();
    $this->withToken(mobilePlacesToken($owner))->getJson("/api/v1/places/{$pending->id}")
        ->assertOk()
        ->assertJsonPath('status', 'pending');
    $this->withToken(mobilePlacesToken($owner))->getJson("/api/v1/places/{$approved->id}")
        ->assertOk()
        ->assertJsonPath('liked_by_me', true)
        ->assertJsonPath('saved_by_me', true);
});

test('public place reads reject bearer tokens without mobile provenance', function () {
    $user = placesRegularUser();
    $wildcard = $user->createToken('browser-session', ['*'])->plainTextToken;

    $this->withToken($wildcard)->getJson('/api/v1/places')->assertUnauthorized();
});

test('place writes require a verified mobile bearer token', function () {
    $user = placesRegularUser();
    $wildcard = $user->createToken('browser-session', ['*'])->plainTextToken;

    $this->postJson('/api/v1/places', [])->assertUnauthorized();
    $this->actingAs($user)->postJson('/api/v1/places', [])->assertUnauthorized();
    $this->withToken($wildcard)->postJson('/api/v1/places', [])->assertUnauthorized();
});

test('mobile users submit bounded Syria images and receive a pending record', function () {
    Storage::fake('public');
    $user = placesRegularUser();
    $photo = UploadedFile::fake()->image('damascus.jpg', 1800, 1200);

    $response = $this->withToken(mobilePlacesToken($user))->post('/api/v1/places', [
        'name' => 'مقهى النوفرة',
        'category' => 'cultural',
        'description' => 'مقهى تاريخي قديم في دمشق القديمة قرب الجامع الأموي',
        'lat' => 33.5104,
        'lng' => 36.2913,
        'photos' => [$photo],
    ], ['Accept' => 'application/json']);

    $response->assertCreated()->assertExactJson([
        'id' => $response->json('id'),
        'status' => 'pending',
    ]);
    $place = Place::query()->findOrFail($response->json('id'));
    $stored = PlacePhoto::query()->where('place_id', $place->id)->firstOrFail();
    expect($place->user_id)->toBe($user->id)
        ->and($place->lat)->toBe(33.5104)
        ->and($stored->original_path)->toEndWith('.jpg');
    Storage::disk('public')->assertExists([
        $stored->original_path,
        $stored->display_path,
        $stored->thumb_path,
    ]);

    [$displayWidth, $displayHeight] = getimagesize(Storage::disk('public')->path($stored->display_path));
    [$thumbWidth, $thumbHeight] = getimagesize(Storage::disk('public')->path($stored->thumb_path));
    expect(max($displayWidth, $displayHeight))->toBeLessThanOrEqual(1600)
        ->and([$thumbWidth, $thumbHeight])->toBe([400, 400]);
});

test('submission rejects out of bounds coordinates and unsafe image dimensions', function () {
    Storage::fake('public');
    $user = placesRegularUser();
    $token = mobilePlacesToken($user);
    $payload = [
        'name' => 'مكان سوري',
        'category' => 'natural',
        'description' => 'وصف طويل بما يكفي لتجاوز الحد الأدنى للأحرف المطلوبة',
        'lat' => 33.5,
        'lng' => 36.3,
        'photos' => [UploadedFile::fake()->image('place.jpg', 640, 480)],
    ];

    $this->withToken($token)->post('/api/v1/places', [...$payload, 'lat' => 38.0], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('lat');
    $this->withToken($token)->post('/api/v1/places', [
        ...$payload,
        'photos' => [UploadedFile::fake()->image('wide.jpg', 6001, 200)],
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('photos.0');
    $this->withToken($token)->post('/api/v1/places', [
        ...$payload,
        'photos' => [UploadedFile::fake()->create('fake.jpg', 1, 'image/jpeg')],
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('photos.0');
    $this->withToken($token)->post('/api/v1/places', [
        ...$payload,
        'name' => '   ',
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');

    $this->assertDatabaseCount('places', 0);
});

test('my places returns only the bearer owners records with moderation state', function () {
    $user = placesRegularUser();
    $rejected = Place::factory()->rejected()->create([
        'user_id' => $user->id,
        'rejection_reason' => 'صور غير واضحة',
    ]);
    Place::factory()->approved()->create(['user_id' => $user->id]);
    Place::factory()->approved()->create();

    $response = $this->withToken(mobilePlacesToken($user))->getJson('/api/v1/my/places')
        ->assertOk()
        ->assertJsonCount(2, 'data');
    $row = collect($response->json('data'))->firstWhere('id', $rejected->id);

    expect($row)->toMatchArray([
        'status' => 'rejected',
        'rejection_reason' => 'صور غير واضحة',
    ])->and($row)->toHaveKeys(['created_at', 'thumb_url', 'comments_count']);
});

test('disabled users cannot use place write endpoints', function () {
    $user = placesRegularUser(['is_banned' => true]);
    $token = mobilePlacesToken($user);

    $this->withToken($token)->postJson('/api/v1/places', [])
        ->assertForbidden()
        ->assertJsonPath('error', 'account_disabled');
    expect($user->tokens()->count())->toBe(0);
});

test('place submissions are throttled after five attempts per hour', function () {
    $user = placesRegularUser();
    $token = mobilePlacesToken($user);

    foreach (range(1, 5) as $attempt) {
        $this->withToken($token)->postJson('/api/v1/places', [])
            ->assertUnprocessable();
    }

    $this->withToken($token)->postJson('/api/v1/places', [])
        ->assertStatus(429);
});

test('image processing removes newly written files when photo persistence fails', function () {
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
