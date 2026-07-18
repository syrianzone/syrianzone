<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

// UserFactory defaults role to admin; regular users must be explicit.
function discoveryUser(array $attrs = []): User {
  return User::factory()->create(array_merge(['role' => 'user'], $attrs));
}

// guides

test('guides aggregates approved places per user with the exact shape', function () {
  $guide = discoveryUser(['name' => 'ليلى', 'avatar_url' => null]);
  Place::factory()->approved()->create(['user_id' => $guide->id, 'saves_count' => 3]);
  Place::factory()->approved()->create(['user_id' => $guide->id, 'saves_count' => 4]);
  Place::factory()->create(['user_id' => $guide->id, 'saves_count' => 99]); // pending, ignored

  $response = $this->getJson('/api/v1/guides')
    ->assertOk()
    ->assertJsonPath('sort', 'submissions')
    ->assertJsonCount(1, 'guides')
    ->assertJsonPath('guides.0.rank', 1)
    ->assertJsonPath('guides.0.user_id', $guide->id)
    ->assertJsonPath('guides.0.name', 'ليلى')
    ->assertJsonPath('guides.0.avatar_url', null)
    ->assertJsonPath('guides.0.approved_count', 2)
    ->assertJsonPath('guides.0.saves_total', 7)
    ->assertJsonPath('guides.0.recent_count', 2);

  expect(array_keys($response->json()))->toBe(['sort', 'guides']);
  expect(array_keys($response->json('guides.0')))
    ->toBe(['rank', 'user_id', 'name', 'avatar_url', 'approved_count', 'saves_total', 'recent_count']);
});

test('guides default sort orders by approved submissions', function () {
  $one = discoveryUser();
  $three = discoveryUser();
  Place::factory()->approved()->create(['user_id' => $one->id]);
  Place::factory()->approved()->count(3)->create(['user_id' => $three->id]);

  $this->getJson('/api/v1/guides')
    ->assertOk()
    ->assertJsonPath('guides.0.user_id', $three->id)
    ->assertJsonPath('guides.0.rank', 1)
    ->assertJsonPath('guides.1.user_id', $one->id)
    ->assertJsonPath('guides.1.rank', 2);
});

test('guides sorts by saves', function () {
  $saved = discoveryUser();
  $prolific = discoveryUser();
  Place::factory()->approved()->create(['user_id' => $saved->id, 'saves_count' => 10]);
  Place::factory()->approved()->count(2)->create(['user_id' => $prolific->id, 'saves_count' => 2]);

  $this->getJson('/api/v1/guides?sort=saves')
    ->assertOk()
    ->assertJsonPath('sort', 'saves')
    ->assertJsonPath('guides.0.user_id', $saved->id)
    ->assertJsonPath('guides.0.saves_total', 10)
    ->assertJsonPath('guides.1.user_id', $prolific->id)
    ->assertJsonPath('guides.1.saves_total', 4);
});

test('guides sorts by recent activity in the last 30 days', function () {
  $veteran = discoveryUser();
  $active = discoveryUser();
  Place::factory()->count(2)->create([
    'user_id' => $veteran->id,
    'status' => 'approved',
    'approved_at' => now()->subDays(60),
  ]);
  Place::factory()->approved()->create(['user_id' => $active->id]);

  $this->getJson('/api/v1/guides?sort=recent')
    ->assertOk()
    ->assertJsonPath('guides.0.user_id', $active->id)
    ->assertJsonPath('guides.0.recent_count', 1)
    ->assertJsonPath('guides.1.user_id', $veteran->id)
    ->assertJsonPath('guides.1.recent_count', 0);
});

test('guides excludes banned and soft deleted users', function () {
  $banned = discoveryUser(['is_banned' => true]);
  $deleted = discoveryUser();
  $visible = discoveryUser();
  Place::factory()->approved()->create(['user_id' => $banned->id]);
  Place::factory()->approved()->create(['user_id' => $deleted->id]);
  Place::factory()->approved()->create(['user_id' => $visible->id]);
  $deleted->delete();

  $this->getJson('/api/v1/guides')
    ->assertOk()
    ->assertJsonCount(1, 'guides')
    ->assertJsonPath('guides.0.user_id', $visible->id);
});

test('guides omits users with no approved places', function () {
  $unapproved = discoveryUser();
  Place::factory()->create(['user_id' => $unapproved->id]);
  Place::factory()->rejected()->create(['user_id' => $unapproved->id]);

  $this->getJson('/api/v1/guides')
    ->assertOk()
    ->assertJsonCount(0, 'guides');
});

test('guides limits to 20', function () {
  Place::factory()->approved()->count(21)->create();

  $this->getJson('/api/v1/guides')
    ->assertOk()
    ->assertJsonCount(20, 'guides')
    ->assertJsonPath('guides.19.rank', 20);
});

test('guides rejects unknown sort', function () {
  $this->getJson('/api/v1/guides?sort=followers')->assertStatus(422);
});

test('guides caches per sort for five minutes', function () {
  $guide = discoveryUser();
  Place::factory()->approved()->create(['user_id' => $guide->id]);

  $this->getJson('/api/v1/guides')->assertOk()->assertJsonCount(1, 'guides');
  expect(Cache::has('places:guides:submissions'))->toBeTrue();

  // new data is invisible until the 5-minute cache expires
  Place::factory()->approved()->create(['user_id' => discoveryUser()->id]);
  $this->getJson('/api/v1/guides')->assertOk()->assertJsonCount(1, 'guides');

  // a different sort has its own cache key and sees the fresh state
  $this->getJson('/api/v1/guides?sort=saves')->assertOk()->assertJsonCount(2, 'guides');
});

// photo grid

test('photo grid returns only approved places photos', function () {
  $approved = Place::factory()->approved()->create();
  $pending = Place::factory()->create();
  $rejected = Place::factory()->rejected()->create();
  $visible = PlacePhoto::factory()->create(['place_id' => $approved->id]);
  PlacePhoto::factory()->create(['place_id' => $pending->id]);
  PlacePhoto::factory()->create(['place_id' => $rejected->id]);

  $response = $this->getJson('/api/v1/places/photos')
    ->assertOk()
    ->assertJsonCount(1, 'data')
    ->assertJsonPath('data.0.id', $visible->id)
    ->assertJsonPath('total', 1);

  expect(collect($response->json('data'))->pluck('place.id')->all())->toBe([$approved->id]);
});

test('photo grid orders newest photo first', function () {
  $place = Place::factory()->approved()->create();
  $old = PlacePhoto::factory()->create(['place_id' => $place->id]);
  $new = PlacePhoto::factory()->create(['place_id' => $place->id, 'sort' => 1]);

  $this->getJson('/api/v1/places/photos')
    ->assertOk()
    ->assertJsonPath('data.0.id', $new->id)
    ->assertJsonPath('data.1.id', $old->id);
});

test('photo grid paginates at 24', function () {
  $place = Place::factory()->approved()->create();
  PlacePhoto::factory()->count(30)->create(['place_id' => $place->id]);

  $this->getJson('/api/v1/places/photos')
    ->assertOk()
    ->assertJsonCount(24, 'data')
    ->assertJsonPath('current_page', 1)
    ->assertJsonPath('last_page', 2)
    ->assertJsonPath('total', 30);

  $this->getJson('/api/v1/places/photos?page=2')
    ->assertOk()
    ->assertJsonCount(6, 'data')
    ->assertJsonPath('current_page', 2);
});

test('photo grid entries carry versioned urls and the place sub shape', function () {
  $place = Place::factory()->approved()->create(['lat' => 33.5104, 'lng' => 36.2913]);
  $photo = PlacePhoto::factory()->create([
    'place_id' => $place->id,
    'thumb_path' => "places/{$place->id}/abc_thumb.webp",
    'display_path' => "places/{$place->id}/abc_display.webp",
  ]);

  $response = $this->getJson('/api/v1/places/photos')
    ->assertOk()
    ->assertJsonPath('data.0.id', $photo->id)
    ->assertJsonPath('data.0.place.id', $place->id)
    ->assertJsonPath('data.0.place.name', $place->name)
    ->assertJsonPath('data.0.place.category', $place->category)
    ->assertJsonPath('data.0.place.lat', 33.5104)
    ->assertJsonPath('data.0.place.lng', 36.2913);

  expect(array_keys($response->json('data.0')))->toBe(['id', 'thumb_url', 'display_url', 'place']);
  expect(array_keys($response->json('data.0.place')))->toBe(['id', 'name', 'category', 'lat', 'lng']);

  $thumbPrefix = Storage::disk(config('filesystems.media_disk'))->url("places/{$place->id}/abc_thumb.webp") . '?v=';
  expect($response->json('data.0.thumb_url'))->toStartWith($thumbPrefix)->not->toEndWith('v=0');
  $displayPrefix = Storage::disk(config('filesystems.media_disk'))->url("places/{$place->id}/abc_display.webp") . '?v=';
  expect($response->json('data.0.display_url'))->toStartWith($displayPrefix);
});
