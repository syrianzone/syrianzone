<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

// UserFactory defaults role to admin; regular users must be explicit.
function placesUser(array $attrs = []): User {
  return User::factory()->create(array_merge(['role' => 'user'], $attrs));
}

test('map returns approved places as geojson', function () {
  $place = Place::factory()->approved()->create(['lat' => 33.5104, 'lng' => 36.2913]);
  PlacePhoto::factory()->create([
    'place_id' => $place->id,
    'thumb_path' => "places/{$place->id}/abc_thumb.webp",
  ]);
  Place::factory()->create();

  $response = $this->getJson('/api/v1/places/map')
    ->assertOk()
    ->assertJsonPath('type', 'FeatureCollection')
    ->assertJsonCount(1, 'features')
    ->assertJsonPath('features.0.type', 'Feature')
    ->assertJsonPath('features.0.geometry.type', 'Point')
    ->assertJsonPath('features.0.properties.id', $place->id)
    ->assertJsonPath('features.0.properties.name', $place->name)
    ->assertJsonPath('features.0.properties.category', $place->category)
    ->assertJsonPath('features.0.properties.thumb_url', "/storage/places/{$place->id}/abc_thumb.webp");

  // GeoJSON order is [lng, lat].
  expect($response->json('features.0.geometry.coordinates'))->toBe([36.2913, 33.5104]);
});

test('map thumb_url is null without photos', function () {
  Place::factory()->approved()->create();

  $this->getJson('/api/v1/places/map')
    ->assertOk()
    ->assertJsonPath('features.0.properties.thumb_url', null);
});

test('list returns only approved places with list item shape', function () {
  $approved = Place::factory()->approved()->create();
  Place::factory()->create();
  Place::factory()->rejected()->create();

  $this->getJson('/api/v1/places')
    ->assertOk()
    ->assertJsonCount(1, 'data')
    ->assertJsonPath('data.0.id', $approved->id)
    ->assertJsonStructure(['data' => [['id', 'name', 'category', 'description', 'lat', 'lng', 'thumb_url', 'likes_count', 'saves_count', 'comments_count']]]);
});

test('list filters by category', function () {
  Place::factory()->approved()->create(['category' => 'historical']);
  Place::factory()->approved()->create(['category' => 'natural']);

  $this->getJson('/api/v1/places?category=historical')
    ->assertOk()
    ->assertJsonCount(1, 'data')
    ->assertJsonPath('data.0.category', 'historical');
});

test('list rejects unknown category', function () {
  $this->getJson('/api/v1/places?category=bogus')->assertStatus(422);
});

test('list searches name and description', function () {
  Place::factory()->approved()->create(['name' => 'مقهى النوفرة', 'description' => str_repeat('وصف عادي ', 5)]);
  Place::factory()->approved()->create(['name' => 'مكان آخر', 'description' => 'قرب النوفرة القديمة في دمشق']);
  Place::factory()->approved()->create(['name' => 'قلعة حلب', 'description' => str_repeat('وصف عادي ', 5)]);

  $this->getJson('/api/v1/places?q=' . urlencode('النوفرة'))
    ->assertOk()
    ->assertJsonCount(2, 'data');
});

test('list sorts by popularity', function () {
  Place::factory()->approved()->create(['likes_count' => 1]);
  $popular = Place::factory()->approved()->create(['likes_count' => 9]);

  $this->getJson('/api/v1/places?sort=popular')
    ->assertOk()
    ->assertJsonPath('data.0.id', $popular->id);
});

test('list paginates at 20', function () {
  Place::factory()->approved()->count(25)->create();

  $this->getJson('/api/v1/places')
    ->assertOk()
    ->assertJsonCount(20, 'data')
    ->assertJsonPath('total', 25)
    ->assertJsonPath('last_page', 2);

  $this->getJson('/api/v1/places?page=2')->assertOk()->assertJsonCount(5, 'data');
});

test('nearby returns places sorted by distance and excludes out of radius', function () {
  // Pure latitude offsets: 0.0005 deg = 56 m, 0.009 deg = 1001 m, 0.02 deg = 2224 m.
  $nearest = Place::factory()->approved()->create(['lat' => 33.5005, 'lng' => 36.3]);
  $near = Place::factory()->approved()->create(['lat' => 33.509, 'lng' => 36.3]);
  Place::factory()->approved()->create(['lat' => 33.52, 'lng' => 36.3]);

  $response = $this->getJson('/api/v1/places/nearby?lat=33.5&lng=36.3')
    ->assertOk()
    ->assertJsonCount(2, 'places')
    ->assertJsonPath('places.0.id', $nearest->id)
    ->assertJsonPath('places.1.id', $near->id);

  expect($response->json('places.0.distance_m'))->toBeGreaterThan(46)->toBeLessThan(66);
  expect($response->json('places.1.distance_m'))->toBeGreaterThan(991)->toBeLessThan(1011);
});

test('nearby honors radius_km', function () {
  Place::factory()->approved()->create(['lat' => 33.52, 'lng' => 36.3]);

  $this->getJson('/api/v1/places/nearby?lat=33.5&lng=36.3&radius_km=3')
    ->assertOk()
    ->assertJsonCount(1, 'places');
});

test('nearby validates params', function () {
  $this->getJson('/api/v1/places/nearby?lng=36.3')->assertStatus(422);
  $this->getJson('/api/v1/places/nearby?lat=33.5&lng=36.3&radius_km=30')->assertStatus(422);
});

test('nearby include_pending exposes only the requester own pending places', function () {
  $owner = placesUser();
  Place::factory()->create(['lat' => 33.5001, 'lng' => 36.3, 'user_id' => $owner->id]);

  $this->getJson('/api/v1/places/nearby?lat=33.5&lng=36.3&include_pending=1')
    ->assertOk()
    ->assertJsonCount(0, 'places');

  $this->actingAs($owner)
    ->getJson('/api/v1/places/nearby?lat=33.5&lng=36.3&include_pending=1')
    ->assertOk()
    ->assertJsonCount(1, 'places');

  $this->actingAs(placesUser())
    ->getJson('/api/v1/places/nearby?lat=33.5&lng=36.3&include_pending=1')
    ->assertOk()
    ->assertJsonCount(0, 'places');

  $this->actingAs($owner)
    ->getJson('/api/v1/places/nearby?lat=33.5&lng=36.3')
    ->assertOk()
    ->assertJsonCount(0, 'places');
});

test('show returns detail for approved place', function () {
  $place = Place::factory()->approved()->create();

  $this->getJson("/api/v1/places/{$place->id}")
    ->assertOk()
    ->assertJsonPath('id', $place->id)
    ->assertJsonPath('status', 'approved')
    ->assertJsonPath('liked_by_me', false)
    ->assertJsonPath('saved_by_me', false)
    ->assertJsonStructure(['user' => ['id', 'name', 'avatar_url'], 'photos', 'created_at']);
});

test('show hides pending place from guests and strangers but not owner or admin', function () {
  $owner = placesUser();
  $place = Place::factory()->create(['user_id' => $owner->id]);

  $this->getJson("/api/v1/places/{$place->id}")->assertNotFound();
  $this->actingAs(placesUser())->getJson("/api/v1/places/{$place->id}")->assertNotFound();
  $this->actingAs($owner)->getJson("/api/v1/places/{$place->id}")->assertOk()->assertJsonPath('status', 'pending');
  $this->actingAs(User::factory()->create(['role' => 'admin']))
    ->getJson("/api/v1/places/{$place->id}")->assertOk();
});

test('show returns 404 for missing place', function () {
  $this->getJson('/api/v1/places/999')->assertNotFound();
});

test('show still works after the author soft-deletes their account', function () {
  $owner = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $owner->id]);
  $owner->delete();

  $this->getJson("/api/v1/places/{$place->id}")
    ->assertOk()
    ->assertJsonPath('user.id', $owner->id)
    ->assertJsonPath('user.name', $owner->name);
});

test('guest cannot submit a place', function () {
  $this->postJson('/api/v1/places', [])->assertUnauthorized();
});

test('can submit a place with photos', function () {
  Storage::fake('public');
  $user = placesUser();

  $response = $this->actingAs($user)->post('/api/v1/places', [
    'name' => 'مقهى النوفرة',
    'category' => 'cultural',
    'description' => 'مقهى تاريخي قديم في دمشق القديمة قرب الجامع الأموي',
    'lat' => 33.5104,
    'lng' => 36.2913,
    'photos' => [UploadedFile::fake()->image('photo.jpg', 640, 480)],
  ], ['Accept' => 'application/json']);

  $response->assertCreated()->assertJsonPath('status', 'pending');
  $id = $response->json('id');

  $this->assertDatabaseHas('places', ['id' => $id, 'user_id' => $user->id, 'status' => 'pending']);
  $photo = PlacePhoto::where('place_id', $id)->firstOrFail();
  Storage::disk('public')->assertExists([$photo->original_path, $photo->display_path, $photo->thumb_path]);
});

test('submit validation rejects bad payloads', function () {
  Storage::fake('public');
  $user = placesUser();
  $valid = fn () => [
    'name' => 'مكان',
    'category' => 'natural',
    'description' => 'وصف طويل بما يكفي لتجاوز الحد الأدنى للأحرف المطلوبة',
    'lat' => 33.5,
    'lng' => 36.3,
    'photos' => [UploadedFile::fake()->image('p.jpg', 640, 480)],
  ];

  $post = fn (array $overrides) => $this->actingAs($user)
    ->post('/api/v1/places', array_merge($valid(), $overrides), ['Accept' => 'application/json']);

  // Submit throttle is 5 per hour: keep this test at 4 requests, photo rules get their own test.
  $post(['photos' => []])->assertStatus(422)->assertJsonValidationErrors('photos');
  $post(['description' => 'قصير'])->assertStatus(422)->assertJsonValidationErrors('description');
  $post(['lat' => 45.0])->assertStatus(422)->assertJsonValidationErrors('lat');
  $post(['category' => 'bogus'])->assertStatus(422)->assertJsonValidationErrors('category');

  $this->assertDatabaseCount('places', 0);
});

test('submit validation rejects bad photos', function () {
  Storage::fake('public');
  $user = placesUser();

  $post = fn (array $photos) => $this->actingAs($user)->post('/api/v1/places', [
    'name' => 'مكان',
    'category' => 'natural',
    'description' => 'وصف طويل بما يكفي لتجاوز الحد الأدنى للأحرف المطلوبة',
    'lat' => 33.5,
    'lng' => 36.3,
    'photos' => $photos,
  ], ['Accept' => 'application/json']);

  $post([UploadedFile::fake()->image('tiny.jpg', 100, 100)])
    ->assertStatus(422)->assertJsonValidationErrors('photos.0');
  $post([UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf')])
    ->assertStatus(422)->assertJsonValidationErrors('photos.0');

  $this->assertDatabaseCount('places', 0);
});

test('banned user cannot submit', function () {
  $this->actingAs(placesUser(['is_banned' => true]))
    ->postJson('/api/v1/places', [])
    ->assertForbidden()
    ->assertJsonPath('message', 'تم حظر حسابك من المساهمة');
});

test('submit is throttled after 5 requests per hour', function () {
  $user = placesUser();

  foreach (range(1, 5) as $i) {
    $this->actingAs($user)->postJson('/api/v1/places', [])->assertStatus(422);
  }
  $this->actingAs($user)->postJson('/api/v1/places', [])->assertStatus(429);
});

test('my places lists own places with status and rejection_reason', function () {
  $user = placesUser();
  $rejected = Place::factory()->rejected()->create(['user_id' => $user->id, 'rejection_reason' => 'صور غير واضحة']);
  Place::factory()->approved()->create(['user_id' => $user->id]);
  Place::factory()->approved()->create();

  $response = $this->actingAs($user)->getJson('/api/v1/my/places')
    ->assertOk()
    ->assertJsonCount(2, 'data');

  $row = collect($response->json('data'))->firstWhere('id', $rejected->id);
  expect($row['status'])->toBe('rejected');
  expect($row['rejection_reason'])->toBe('صور غير واضحة');
});

test('guest cannot list my places', function () {
  $this->getJson('/api/v1/my/places')->assertUnauthorized();
});
