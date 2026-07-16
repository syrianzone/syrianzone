<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

function placesAdmin(): User {
  return User::factory()->create(['role' => 'admin']);
}

test('admin endpoints reject guests and non-admins', function () {
  $place = Place::factory()->create();
  $user = User::factory()->create(['role' => 'user']);

  $this->getJson('/api/v1/admin/places')->assertUnauthorized();

  $this->actingAs($user)->getJson('/api/v1/admin/places')->assertForbidden();
  $this->actingAs($user)->postJson("/api/v1/admin/places/{$place->id}/approve")->assertForbidden();
  $this->actingAs($user)->postJson("/api/v1/admin/places/{$place->id}/reject")->assertForbidden();
  $this->actingAs($user)->deleteJson("/api/v1/admin/places/{$place->id}")->assertForbidden();
});

test('admin list defaults to pending and filters by status', function () {
  $pending = Place::factory()->create();
  $approved = Place::factory()->approved()->create();
  Place::factory()->rejected()->create();

  $this->actingAs(placesAdmin())->getJson('/api/v1/admin/places')
    ->assertOk()
    ->assertJsonCount(1, 'data')
    ->assertJsonPath('data.0.id', $pending->id)
    ->assertJsonStructure(['data' => [['id', 'name', 'status', 'rejection_reason', 'photos', 'user' => ['id', 'name', 'avatar_url']]]]);

  $this->actingAs(placesAdmin())->getJson('/api/v1/admin/places?status=approved')
    ->assertOk()
    ->assertJsonCount(1, 'data')
    ->assertJsonPath('data.0.id', $approved->id);

  $this->actingAs(placesAdmin())->getJson('/api/v1/admin/places?status=all')
    ->assertOk()
    ->assertJsonCount(3, 'data');

  $this->actingAs(placesAdmin())->getJson('/api/v1/admin/places?status=bogus')->assertStatus(422);
});

test('admin can approve a pending place', function () {
  $place = Place::factory()->create();

  $this->actingAs(placesAdmin())->postJson("/api/v1/admin/places/{$place->id}/approve")
    ->assertOk()
    ->assertJsonPath('status', 'approved');

  $place->refresh();
  expect($place->status)->toBe('approved');
  expect($place->approved_at)->not->toBeNull();
});

test('approve is rejected for non-pending places', function () {
  $place = Place::factory()->approved()->create();

  $this->actingAs(placesAdmin())->postJson("/api/v1/admin/places/{$place->id}/approve")
    ->assertStatus(400)
    ->assertJsonPath('message', 'Place is already approved');
});

test('admin can reject a pending place with a reason', function () {
  $place = Place::factory()->create();

  $this->actingAs(placesAdmin())
    ->postJson("/api/v1/admin/places/{$place->id}/reject", ['reason' => 'صور غير واضحة'])
    ->assertOk()
    ->assertJsonPath('status', 'rejected');

  $this->assertDatabaseHas('places', ['id' => $place->id, 'status' => 'rejected', 'rejection_reason' => 'صور غير واضحة']);
});

test('reject is rejected for non-pending places', function () {
  $place = Place::factory()->rejected()->create();

  $this->actingAs(placesAdmin())->postJson("/api/v1/admin/places/{$place->id}/reject")
    ->assertStatus(400)
    ->assertJsonPath('message', 'Place is already rejected');
});

test('approving a place makes it appear on the cached map', function () {
  $place = Place::factory()->create();

  // Prime the cache while the place is still pending.
  $this->getJson('/api/v1/places/map')->assertOk()->assertJsonCount(0, 'features');

  $this->actingAs(placesAdmin())->postJson("/api/v1/admin/places/{$place->id}/approve")->assertOk();

  $this->getJson('/api/v1/places/map')
    ->assertOk()
    ->assertJsonCount(1, 'features')
    ->assertJsonPath('features.0.properties.id', $place->id);
});

test('admin delete removes rows and photo files', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();
  $photo = PlacePhoto::factory()->create([
    'place_id' => $place->id,
    'original_path' => "places/{$place->id}/abc.jpg",
    'display_path' => "places/{$place->id}/abc_display.webp",
    'thumb_path' => "places/{$place->id}/abc_thumb.webp",
  ]);
  foreach ([$photo->original_path, $photo->display_path, $photo->thumb_path] as $path) {
    Storage::disk('public')->put($path, 'x');
  }

  $this->actingAs(placesAdmin())->deleteJson("/api/v1/admin/places/{$place->id}")->assertNoContent();

  $this->assertDatabaseMissing('places', ['id' => $place->id]);
  $this->assertDatabaseMissing('place_photos', ['id' => $photo->id]);
  Storage::disk('public')->assertMissing([$photo->original_path, $photo->display_path, $photo->thumb_path]);
});

test('deleting an approved place busts the map cache', function () {
  $place = Place::factory()->approved()->create();

  $this->getJson('/api/v1/places/map')->assertOk()->assertJsonCount(1, 'features');

  $this->actingAs(placesAdmin())->deleteJson("/api/v1/admin/places/{$place->id}")->assertNoContent();

  $this->getJson('/api/v1/places/map')->assertOk()->assertJsonCount(0, 'features');
});
