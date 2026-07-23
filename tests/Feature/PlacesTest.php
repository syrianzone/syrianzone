<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
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
    ->assertJsonPath('features.0.properties.thumb_url', function ($url) use ($place) {
      $expected = Storage::disk(config('filesystems.media_disk'))->url("places/{$place->id}/abc_thumb.webp") . '?v=';
      return str_starts_with($url, $expected) && !str_ends_with($url, 'v=0');
    });

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
    ->assertJsonStructure(['data' => [['id', 'name', 'category', 'description', 'lat', 'lng', 'thumb_url', 'saves_count']]]);
});

test('list items do not leak removed counters', function () {
  $place = Place::factory()->approved()->create();

  $this->getJson('/api/v1/places')
    ->assertOk()
    ->assertJsonMissingPath('data.0.likes_count')
    ->assertJsonMissingPath('data.0.comments_count');

  $this->getJson("/api/v1/places/{$place->id}")
    ->assertOk()
    ->assertJsonMissingPath('liked_by_me');
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

test('popular sort orders by saves_count', function () {
  Place::factory()->approved()->create(['saves_count' => 1]);
  $popular = Place::factory()->approved()->create(['saves_count' => 9]);

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

test('geocode proxies google places and maps the suggestion shape', function () {
  config(['services.google_places.key' => 'test-key']);
  Http::fake(['places.googleapis.com/*' => Http::response(['places' => [[
    'displayName' => ['text' => 'سوق الحميدية'],
    'formattedAddress' => 'دمشق، سوريا',
    'location' => ['latitude' => 33.5112, 'longitude' => 36.3037],
  ]]])]);

  $this->getJson('/api/v1/places/geocode?q=' . urlencode('الحميدية'))
    ->assertOk()
    ->assertJsonCount(1, 'suggestions')
    ->assertJsonPath('suggestions.0.name', 'سوق الحميدية')
    ->assertJsonPath('suggestions.0.lat', 33.5112)
    ->assertJsonPath('suggestions.0.lng', 36.3037);
});

test('geocode returns empty without a configured key and calls nothing', function () {
  config(['services.google_places.key' => null]);
  Http::fake();

  $this->getJson('/api/v1/places/geocode?q=damascus')->assertOk()->assertJsonCount(0, 'suggestions');
  Http::assertNothingSent();
});

test('geocode validates the query length', function () {
  $this->getJson('/api/v1/places/geocode?q=a')->assertStatus(422);
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

test('show exposes the contributor level and points', function () {
  $owner = placesUser();
  $place = Place::factory()->approved()->create([
    'user_id' => $owner->id,
    'description' => str_repeat('م', 200),
    'saves_count' => 4,
  ]);
  PlacePhoto::factory()->count(2)->create(['place_id' => $place->id]);

  // 15 place + 2*5 photos + 5 description + 4 saves = 34 => level 2
  $this->getJson("/api/v1/places/{$place->id}")
    ->assertOk()
    ->assertJsonPath('user.level', 2)
    ->assertJsonPath('user.points', 34);
});

test('show on an owner-visible pending place carries level and points', function () {
  $owner = placesUser();
  $place = Place::factory()->create(['user_id' => $owner->id, 'saves_count' => 9]);

  // the pending place itself contributes nothing: 0 points, level 1
  $this->actingAs($owner)
    ->getJson("/api/v1/places/{$place->id}")
    ->assertOk()
    ->assertJsonPath('status', 'pending')
    ->assertJsonPath('user.level', 1)
    ->assertJsonPath('user.points', 0);
});

test('show caches contributor points per user for five minutes', function () {
  $owner = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $owner->id, 'saves_count' => 0]);

  $this->getJson("/api/v1/places/{$place->id}")->assertOk()->assertJsonPath('user.points', 15);
  expect(Cache::has("places:guide-points:{$owner->id}"))->toBeTrue();

  // staleness accepted: fresh photos are invisible until the per-user key expires
  PlacePhoto::factory()->create(['place_id' => $place->id]);
  $this->getJson("/api/v1/places/{$place->id}")->assertOk()->assertJsonPath('user.points', 15);

  Cache::flush();
  $this->getJson("/api/v1/places/{$place->id}")->assertOk()->assertJsonPath('user.points', 20);
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

// 400x300 landscape pixels + EXIF orientation 6 = a phone portrait photo:
// correct processing must rotate it, so the stored display image is 300x400.
function portraitExifUpload(): \Illuminate\Http\UploadedFile {
  $img = imagecreatetruecolor(400, 300);
  imagefill($img, 0, 0, imagecolorallocate($img, 200, 50, 50));
  ob_start();
  imagejpeg($img);
  $jpeg = ob_get_clean();
  $exif = "Exif\x00\x00" . 'II' . pack('v', 42) . pack('V', 8)
    . pack('v', 1)                                             // one IFD0 entry
    . pack('v', 0x0112) . pack('v', 3) . pack('V', 1) . pack('v', 6) . pack('v', 0) // Orientation = 6
    . pack('V', 0);                                            // no next IFD
  $bytes = substr($jpeg, 0, 2) . "\xFF\xE1" . pack('n', strlen($exif) + 2) . $exif . substr($jpeg, 2);
  $path = tempnam(sys_get_temp_dir(), 'exif') . '.jpg';
  file_put_contents($path, $bytes);
  return new \Illuminate\Http\UploadedFile($path, 'portrait.jpg', 'image/jpeg', null, true);
}

test('photo processing honors exif portrait orientation', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();

  $photo = app(\App\Services\PlaceImageService::class)->store(portraitExifUpload(), $place->id, 0);

  [$width, $height] = getimagesizefromstring(Storage::disk('public')->get($photo->display_path));
  expect($height)->toBeGreaterThan($width);
});

test('reprocess-photos command regenerates variants from the originals', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();
  $photo = app(\App\Services\PlaceImageService::class)->store(portraitExifUpload(), $place->id, 0);

  // simulate output of the broken pipeline: an unrotated landscape display image
  $img = imagecreatetruecolor(400, 300);
  ob_start();
  imagewebp($img);
  Storage::disk('public')->put($photo->display_path, ob_get_clean());

  $this->artisan('places:reprocess-photos')->assertSuccessful();

  [$width, $height] = getimagesizefromstring(Storage::disk('public')->get($photo->display_path));
  expect($height)->toBeGreaterThan($width);
});

test('there is no per-user submission cap', function () {
  Storage::fake('public');
  $user = placesUser();
  Place::factory()->count(5)->create(['user_id' => $user->id]);

  // a sixth place in the same hour used to 429; moderation is the real gate now
  $this->actingAs($user)->postJson('/api/v1/places', [
    'name' => 'مكان سادس',
    'category' => 'natural',
    'description' => 'وصف تجريبي طويل بما يكفي لتجاوز الحد الأدنى للتحقق',
    'lat' => 33.5,
    'lng' => 36.3,
    'photos' => [UploadedFile::fake()->image('b.jpg', 800, 600)],
  ])->assertStatus(201);
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

test('owner moves pin of an approved place back to pending and busts the map cache', function () {
  $user = placesUser();
  $place = Place::factory()->approved()->create([
    'user_id' => $user->id, 'lat' => 33.5, 'lng' => 36.3, 'approved_at' => now(),
  ]);
  Cache::put('places:map', ['type' => 'FeatureCollection', 'features' => []], 300);

  $this->actingAs($user)
    ->patchJson("/api/v1/my/places/{$place->id}/location", ['lat' => 33.51234, 'lng' => 36.29876])
    ->assertOk()
    ->assertJsonPath('id', $place->id)
    ->assertJsonPath('lat', 33.51234)
    ->assertJsonPath('lng', 36.29876)
    ->assertJsonPath('status', 'pending');

  $fresh = $place->fresh();
  expect($fresh->lat)->toBe(33.51234);
  expect($fresh->lng)->toBe(36.29876);
  expect($fresh->status)->toBe('pending');
  expect($fresh->rejection_reason)->toBeNull();
  expect($fresh->approved_at)->toBeNull();
  expect(Cache::missing('places:map'))->toBeTrue();
});

test('owner moves pin of a rejected place and the rejection reason clears', function () {
  $user = placesUser();
  $place = Place::factory()->rejected()->create([
    'user_id' => $user->id, 'rejection_reason' => 'صور غير واضحة',
  ]);

  $this->actingAs($user)
    ->patchJson("/api/v1/my/places/{$place->id}/location", ['lat' => 34.73941, 'lng' => 36.67507])
    ->assertOk()
    ->assertJsonPath('status', 'pending');

  $fresh = $place->fresh();
  expect($fresh->status)->toBe('pending');
  expect($fresh->rejection_reason)->toBeNull();
});

test('stranger cannot move another user pin', function () {
  $place = Place::factory()->approved()->create(['lat' => 33.5, 'lng' => 36.3]);

  $this->actingAs(placesUser())
    ->patchJson("/api/v1/my/places/{$place->id}/location", ['lat' => 34.0, 'lng' => 36.5])
    ->assertNotFound();

  $fresh = $place->fresh();
  expect($fresh->lat)->toBe(33.5);
  expect($fresh->lng)->toBe(36.3);
  expect($fresh->status)->toBe('approved');
});

test('guest cannot move a pin', function () {
  $place = Place::factory()->approved()->create();

  $this->patchJson("/api/v1/my/places/{$place->id}/location", ['lat' => 34.0, 'lng' => 36.5])
    ->assertUnauthorized();
});

test('moving a pin outside syria returns the arabic between messages', function () {
  $user = placesUser();
  $place = Place::factory()->create(['user_id' => $user->id]);

  $this->actingAs($user)
    ->patchJson("/api/v1/my/places/{$place->id}/location", ['lat' => 31.9, 'lng' => 43.0])
    ->assertStatus(422)
    ->assertJsonPath('errors.lat.0', 'خط العرض يجب أن يكون بين 32.0 و 37.5 (داخل سوريا)')
    ->assertJsonPath('errors.lng.0', 'خط الطول يجب أن يكون بين 35.5 و 42.5 (داخل سوريا)');
});

test('moving a pin with missing or non-numeric coords returns the arabic messages', function () {
  $user = placesUser();
  $place = Place::factory()->create(['user_id' => $user->id]);

  $this->actingAs($user)
    ->patchJson("/api/v1/my/places/{$place->id}/location", [])
    ->assertStatus(422)
    ->assertJsonPath('errors.lat.0', 'أدخل الإحداثيات')
    ->assertJsonPath('errors.lng.0', 'أدخل الإحداثيات');

  $this->actingAs($user)
    ->patchJson("/api/v1/my/places/{$place->id}/location", ['lat' => 'abc', 'lng' => 'def'])
    ->assertStatus(422)
    ->assertJsonPath('errors.lat.0', 'خط العرض يجب أن يكون رقماً')
    ->assertJsonPath('errors.lng.0', 'خط الطول يجب أن يكون رقماً');
});

test('submit validation errors carry the exact arabic messages', function () {
  Storage::fake('public');
  $user = placesUser();

  // name.max, description.min, lat.between, photos.max in one request
  $this->actingAs($user)->post('/api/v1/places', [
    'name' => str_repeat('م', 161),
    'category' => 'natural',
    'description' => 'قصير',
    'lat' => 45.0,
    'lng' => 36.3,
    'photos' => array_map(fn () => UploadedFile::fake()->image('p.jpg', 640, 480), range(1, 11)),
  ], ['Accept' => 'application/json'])
    ->assertStatus(422)
    ->assertJsonPath('errors.name.0', 'اسم المكان يجب ألا يتجاوز 160 حرفاً')
    ->assertJsonPath('errors.description.0', 'الوصف يجب ألا يقل عن 20 حرفاً')
    ->assertJsonPath('errors.lat.0', 'خط العرض يجب أن يكون بين 32.0 و 37.5 (داخل سوريا)')
    ->assertJsonPath('errors.photos.0', 'الحد الأقصى 10 صور');

  // description.max, photos.*.max, photos.*.dimensions in a second request
  $this->actingAs($user)->post('/api/v1/places', [
    'name' => 'مكان',
    'category' => 'natural',
    'description' => str_repeat('وصف ', 300),
    'lat' => 33.5,
    'lng' => 36.3,
    'photos' => [
      UploadedFile::fake()->image('big.jpg', 640, 480)->size(13000),
      UploadedFile::fake()->image('tiny.jpg', 100, 100),
    ],
  ], ['Accept' => 'application/json'])
    ->assertStatus(422)
    ->assertJsonPath('errors.description.0', 'الوصف يجب ألا يتجاوز 1000 حرف')
    ->assertJsonPath('errors', fn ($errors) => in_array('حجم الصورة يجب ألا يتجاوز 12 ميغابايت', $errors['photos.0'] ?? [])
      && in_array('أبعاد الصورة يجب أن تكون بين 200x200 و 6000x6000 بكسل', $errors['photos.1'] ?? []));

  $this->assertDatabaseCount('places', 0);
});

test('submit accepts ten photos', function () {
  Storage::fake('public');
  $user = placesUser();

  $response = $this->actingAs($user)->post('/api/v1/places', [
    'name' => 'مكان بعشر صور',
    'category' => 'natural',
    'description' => 'وصف تجريبي طويل بما يكفي لتجاوز الحد الأدنى للتحقق',
    'lat' => 33.5,
    'lng' => 36.3,
    'photos' => array_map(fn () => UploadedFile::fake()->image('p.jpg', 640, 480), range(1, 10)),
  ], ['Accept' => 'application/json'])->assertCreated();

  expect(PlacePhoto::where('place_id', $response->json('id'))->count())->toBe(10);
});

test('guests cannot use the owner management endpoints', function () {
  $this->patchJson('/api/v1/my/places/1', ['name' => 'اسم'])->assertUnauthorized();
  $this->postJson('/api/v1/my/places/1/photos')->assertUnauthorized();
  $this->postJson('/api/v1/my/places/1/resubmit')->assertUnauthorized();
  $this->deleteJson('/api/v1/my/places/1')->assertUnauthorized();
  $this->deleteJson('/api/v1/my/place-photos/1')->assertUnauthorized();
  $this->postJson('/api/v1/my/place-photos/1/rotate')->assertUnauthorized();
});

test('owner edits details and the place goes back to pending', function () {
  $user = placesUser();
  $place = Place::factory()->approved()->create([
    'user_id' => $user->id, 'name' => 'الاسم القديم', 'approved_at' => now(),
  ]);
  Cache::put('places:map', ['stale'], 300);

  $this->actingAs($user)
    ->patchJson("/api/v1/my/places/{$place->id}", ['name' => 'الاسم الجديد'])
    ->assertOk()
    ->assertJsonPath('id', $place->id)
    ->assertJsonPath('name', 'الاسم الجديد')
    ->assertJsonPath('status', 'pending');

  $fresh = $place->fresh();
  expect($fresh->name)->toBe('الاسم الجديد');
  expect($fresh->status)->toBe('pending');
  expect($fresh->rejection_reason)->toBeNull();
  expect($fresh->approved_at)->toBeNull();
  expect(Cache::missing('places:map'))->toBeTrue();
});

test('owner edits a rejected place and the rejection reason clears', function () {
  $user = placesUser();
  $place = Place::factory()->rejected()->create([
    'user_id' => $user->id, 'rejection_reason' => 'صور غير واضحة',
  ]);

  $this->actingAs($user)
    ->patchJson("/api/v1/my/places/{$place->id}", [
      'description' => 'وصف جديد طويل بما يكفي لتجاوز الحد الأدنى للأحرف المطلوبة',
    ])
    ->assertOk()
    ->assertJsonPath('status', 'pending');

  $fresh = $place->fresh();
  expect($fresh->status)->toBe('pending');
  expect($fresh->rejection_reason)->toBeNull();
});

test('stranger and guest cannot edit another user place details', function () {
  $place = Place::factory()->approved()->create(['name' => 'قلعة']);

  $this->patchJson("/api/v1/my/places/{$place->id}", ['name' => 'اسم'])->assertUnauthorized();

  $this->actingAs(placesUser())
    ->patchJson("/api/v1/my/places/{$place->id}", ['name' => 'اسم جديد'])
    ->assertNotFound();

  $fresh = $place->fresh();
  expect($fresh->name)->toBe('قلعة');
  expect($fresh->status)->toBe('approved');
});

test('editing details with an empty body is a 422', function () {
  $user = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $user->id]);

  $this->actingAs($user)
    ->patchJson("/api/v1/my/places/{$place->id}", [])
    ->assertStatus(422)
    ->assertJsonPath('message', 'لا توجد تعديلات');

  expect($place->fresh()->status)->toBe('approved');
});

test('details validation errors carry the exact arabic messages', function () {
  $user = placesUser();
  $place = Place::factory()->create(['user_id' => $user->id]);

  $this->actingAs($user)
    ->patchJson("/api/v1/my/places/{$place->id}", [
      'name' => str_repeat('م', 161),
      'category' => 'bogus',
      'description' => 'قصير',
    ])
    ->assertStatus(422)
    ->assertJsonPath('errors.name.0', 'اسم المكان يجب ألا يتجاوز 160 حرفاً')
    ->assertJsonPath('errors.category.0', 'التصنيف المختار غير صالح')
    ->assertJsonPath('errors.description.0', 'الوصف يجب ألا يقل عن 20 حرفاً');
});

test('owner adds a photo and the place goes back to pending', function () {
  Storage::fake('public');
  $user = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $user->id, 'approved_at' => now()]);
  app(\App\Services\PlaceImageService::class)
    ->store(UploadedFile::fake()->image('a.jpg', 800, 600), $place->id, 0);
  Cache::put('places:map', ['stale'], 300);

  $response = $this->actingAs($user)
    ->postJson("/api/v1/my/places/{$place->id}/photos", [
      'photo' => UploadedFile::fake()->image('b.jpg', 800, 600),
    ])
    ->assertCreated()
    ->assertJsonPath('sort', 1)
    ->assertJsonPath('place_status', 'pending')
    ->assertJsonStructure(['id', 'thumb_url', 'display_url', 'sort', 'place_status']);

  $photo = PlacePhoto::findOrFail($response->json('id'));
  Storage::disk('public')->assertExists([$photo->original_path, $photo->display_path, $photo->thumb_path]);
  $fresh = $place->fresh();
  expect($fresh->status)->toBe('pending');
  expect($fresh->rejection_reason)->toBeNull();
  expect($fresh->approved_at)->toBeNull();
  expect(Cache::missing('places:map'))->toBeTrue();
});

test('owner add photo is refused at ten photos', function () {
  Storage::fake('public');
  $user = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $user->id]);
  PlacePhoto::factory()->count(10)->sequence(fn ($seq) => ['sort' => $seq->index])->create(['place_id' => $place->id]);

  $this->actingAs($user)
    ->postJson("/api/v1/my/places/{$place->id}/photos", [
      'photo' => UploadedFile::fake()->image('x.jpg', 800, 600),
    ])
    ->assertStatus(422)
    ->assertJsonPath('message', 'لا يمكن إضافة أكثر من 10 صور');

  expect($place->photos()->count())->toBe(10);
  expect($place->fresh()->status)->toBe('approved');
});

test('stranger cannot add a photo to another user place', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();

  $this->actingAs(placesUser())
    ->postJson("/api/v1/my/places/{$place->id}/photos", [
      'photo' => UploadedFile::fake()->image('x.jpg', 800, 600),
    ])
    ->assertNotFound();

  expect($place->photos()->count())->toBe(0);
});

test('owner add photo rejects an oversized file with the arabic message', function () {
  Storage::fake('public');
  $user = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $user->id]);

  $this->actingAs($user)
    ->postJson("/api/v1/my/places/{$place->id}/photos", [
      'photo' => UploadedFile::fake()->image('big.jpg', 640, 480)->size(13000),
    ])
    ->assertStatus(422)
    ->assertJsonPath('errors.photo.0', 'حجم الصورة يجب ألا يتجاوز 12 ميغابايت');

  expect($place->fresh()->status)->toBe('approved');
});

test('owner deletes a photo, files go and the place goes back to pending', function () {
  Storage::fake('public');
  $user = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $user->id, 'approved_at' => now()]);
  app(\App\Services\PlaceImageService::class)
    ->store(UploadedFile::fake()->image('a.jpg', 800, 600), $place->id, 0);
  $victim = app(\App\Services\PlaceImageService::class)
    ->store(UploadedFile::fake()->image('b.jpg', 800, 600), $place->id, 1);
  Cache::put('places:map', ['stale'], 300);

  $this->actingAs($user)
    ->deleteJson("/api/v1/my/place-photos/{$victim->id}")
    ->assertOk()
    ->assertJsonPath('id', $victim->id)
    ->assertJsonPath('place_status', 'pending');

  $this->assertDatabaseMissing('place_photos', ['id' => $victim->id]);
  Storage::disk('public')->assertMissing([$victim->original_path, $victim->display_path, $victim->thumb_path]);
  $fresh = $place->fresh();
  expect($fresh->status)->toBe('pending');
  expect($fresh->rejection_reason)->toBeNull();
  expect($fresh->approved_at)->toBeNull();
  expect(Cache::missing('places:map'))->toBeTrue();
});

test('owner cannot delete the last photo', function () {
  Storage::fake('public');
  $user = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $user->id]);
  $photo = app(\App\Services\PlaceImageService::class)
    ->store(UploadedFile::fake()->image('only.jpg', 800, 600), $place->id, 0);

  $this->actingAs($user)
    ->deleteJson("/api/v1/my/place-photos/{$photo->id}")
    ->assertStatus(422)
    ->assertJsonPath('message', 'لا يمكن حذف الصورة الأخيرة');

  $this->assertDatabaseHas('place_photos', ['id' => $photo->id]);
  Storage::disk('public')->assertExists([$photo->original_path, $photo->display_path, $photo->thumb_path]);
  expect($place->fresh()->status)->toBe('approved');
});

test('stranger cannot delete another user photo', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();
  PlacePhoto::factory()->count(2)->sequence(fn ($seq) => ['sort' => $seq->index])->create(['place_id' => $place->id]);
  $victim = $place->photos()->first();

  $this->actingAs(placesUser())
    ->deleteJson("/api/v1/my/place-photos/{$victim->id}")
    ->assertNotFound();

  $this->assertDatabaseHas('place_photos', ['id' => $victim->id]);
});

test('owner rotate keeps approval and refreshes the versioned urls', function () {
  Storage::fake('public');
  $user = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $user->id, 'approved_at' => now()]);

  // 400x300 landscape display; one clockwise turn must make it 300x400
  $img = imagecreatetruecolor(400, 300);
  ob_start();
  imagewebp($img);
  $displayBytes = ob_get_clean();
  $photo = PlacePhoto::factory()->create([
    'place_id' => $place->id,
    'display_path' => "places/{$place->id}/x_display.webp",
    'thumb_path' => "places/{$place->id}/x_thumb.webp",
  ]);
  Storage::disk('public')->put($photo->display_path, $displayBytes);
  // backdate so the ?v= version visibly changes on rotate
  PlacePhoto::whereKey($photo->id)->update(['updated_at' => now()->subMinute()]);
  $oldUrl = $photo->fresh()->display_url;

  $response = $this->actingAs($user)
    ->postJson("/api/v1/my/place-photos/{$photo->id}/rotate")
    ->assertOk()
    ->assertJsonPath('id', $photo->id);

  expect($response->json('display_url'))->not->toBe($oldUrl);
  [$width, $height] = getimagesizefromstring(Storage::disk('public')->get($photo->fresh()->display_path));
  expect($height)->toBe(400)->and($width)->toBe(300);

  $fresh = $place->fresh();
  expect($fresh->status)->toBe('approved');
  expect($fresh->approved_at)->not->toBeNull();
});

test('owner rotate reports a missing display file', function () {
  Storage::fake('public');
  $user = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $user->id]);
  $photo = PlacePhoto::factory()->create(['place_id' => $place->id]);

  $this->actingAs($user)
    ->postJson("/api/v1/my/place-photos/{$photo->id}/rotate")
    ->assertStatus(422)
    ->assertJsonPath('message', 'ملف الصورة مفقود على الخادم');
});

test('stranger cannot rotate another user photo', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();
  $photo = PlacePhoto::factory()->create(['place_id' => $place->id]);

  $this->actingAs(placesUser())
    ->postJson("/api/v1/my/place-photos/{$photo->id}/rotate")
    ->assertNotFound();
});

test('owner deletes their place along with photo rows and files', function () {
  Storage::fake('public');
  $user = placesUser();
  $place = Place::factory()->approved()->create(['user_id' => $user->id]);
  $photo = app(\App\Services\PlaceImageService::class)
    ->store(UploadedFile::fake()->image('a.jpg', 800, 600), $place->id, 0);
  Cache::put('places:map', ['stale'], 300);

  $this->actingAs($user)->deleteJson("/api/v1/my/places/{$place->id}")->assertNoContent();

  $this->assertDatabaseMissing('places', ['id' => $place->id]);
  $this->assertDatabaseMissing('place_photos', ['id' => $photo->id]);
  Storage::disk('public')->assertMissing([$photo->original_path, $photo->display_path, $photo->thumb_path]);
  expect(Cache::missing('places:map'))->toBeTrue();
});

test('stranger cannot delete another user place', function () {
  $place = Place::factory()->approved()->create();

  $this->actingAs(placesUser())->deleteJson("/api/v1/my/places/{$place->id}")->assertNotFound();

  $this->assertDatabaseHas('places', ['id' => $place->id]);
});

test('owner resubmits a rejected place without touching its files', function () {
  Storage::fake('public');
  $user = placesUser();
  $place = Place::factory()->rejected()->create(['user_id' => $user->id, 'rejection_reason' => 'صور غير واضحة']);
  $photo = app(\App\Services\PlaceImageService::class)
    ->store(UploadedFile::fake()->image('a.jpg', 800, 600), $place->id, 0);
  $paths = [$photo->original_path, $photo->display_path, $photo->thumb_path];

  $this->actingAs($user)
    ->postJson("/api/v1/my/places/{$place->id}/resubmit")
    ->assertOk()
    ->assertJsonPath('id', $place->id)
    ->assertJsonPath('status', 'pending');

  $fresh = $place->fresh();
  expect($fresh->status)->toBe('pending');
  expect($fresh->rejection_reason)->toBeNull();

  $freshPhoto = $photo->fresh();
  expect([$freshPhoto->original_path, $freshPhoto->display_path, $freshPhoto->thumb_path])->toBe($paths);
  Storage::disk('public')->assertExists($paths);
});

test('resubmit is refused for non-rejected places', function () {
  $user = placesUser();
  $pending = Place::factory()->create(['user_id' => $user->id]);
  $approved = Place::factory()->approved()->create(['user_id' => $user->id]);

  $this->actingAs($user)
    ->postJson("/api/v1/my/places/{$pending->id}/resubmit")
    ->assertStatus(400)
    ->assertJsonPath('message', 'لا يمكن إعادة إرسال هذا المكان');

  $this->actingAs($user)
    ->postJson("/api/v1/my/places/{$approved->id}/resubmit")
    ->assertStatus(400);

  expect($pending->fresh()->status)->toBe('pending');
  expect($approved->fresh()->status)->toBe('approved');
});

test('stranger cannot resubmit another user place', function () {
  $place = Place::factory()->rejected()->create(['rejection_reason' => 'سبب']);

  $this->actingAs(placesUser())
    ->postJson("/api/v1/my/places/{$place->id}/resubmit")
    ->assertNotFound();

  expect($place->fresh()->status)->toBe('rejected');
});

test('mishwar page renders with a place deep link param', function () {
  // The share URL is /mishwar?place={id}; the page route must ignore the param.
  $this->get('/mishwar?place=123')->assertOk();
});

test('legacy places slug redirects permanently and keeps the query', function () {
  $this->get('/places?place=123')
    ->assertMovedPermanently()
    ->assertRedirect('/mishwar?place=123');
});

test('list filters to one contributor and map features carry the owner', function () {
  $guide = placesUser();
  $mine = Place::factory()->approved()->create(['user_id' => $guide->id]);
  Place::factory()->approved()->create();

  $this->getJson('/api/v1/places')->assertOk()->assertJsonCount(2, 'data');

  $this->getJson("/api/v1/places?user_id={$guide->id}")
    ->assertOk()
    ->assertJsonCount(1, 'data')
    ->assertJsonPath('data.0.id', $mine->id);

  // the map ships user_id so the client can filter pins without a per-user cache
  $this->getJson('/api/v1/places/map')
    ->assertOk()
    ->assertJsonPath('features.0.properties.user_id', fn ($id) => is_int($id));
});
