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
  $this->actingAs($user)->postJson('/api/v1/admin/place-photos/1/rotate')->assertForbidden();
  $this->actingAs($user)->postJson('/api/v1/admin/place-photos/1/replace')->assertForbidden();
});

test('admin can replace a photo and the new file has fresh paths', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();
  $photo = app(\App\Services\PlaceImageService::class)
    ->store(\Illuminate\Http\UploadedFile::fake()->image('a.jpg', 800, 600), $place->id, 0);
  $oldPaths = [$photo->original_path, $photo->display_path, $photo->thumb_path];

  $this->actingAs(placesAdmin())
    ->postJson("/api/v1/admin/place-photos/{$photo->id}/replace", [
      'photo' => \Illuminate\Http\UploadedFile::fake()->image('b.jpg', 500, 900),
    ])
    ->assertOk()
    ->assertJsonPath('id', $photo->id);

  $photo->refresh();
  expect($photo->display_path)->not->toBe($oldPaths[1]);
  foreach ($oldPaths as $old) {
    Storage::disk('public')->assertMissing($old);
  }
  [$width, $height] = getimagesizefromstring(Storage::disk('public')->get($photo->display_path));
  expect($height)->toBeGreaterThan($width);
});

test('replace rejects a non-image upload', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();
  $photo = PlacePhoto::factory()->create(['place_id' => $place->id]);

  $this->actingAs(placesAdmin())
    ->postJson("/api/v1/admin/place-photos/{$photo->id}/replace", [
      'photo' => \Illuminate\Http\UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf'),
    ])
    ->assertStatus(422);
});

test('rotate reports a missing display file instead of a server error', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();
  $photo = PlacePhoto::factory()->create(['place_id' => $place->id]);

  $this->actingAs(placesAdmin())
    ->postJson("/api/v1/admin/place-photos/{$photo->id}/rotate")
    ->assertStatus(422)
    ->assertJsonPath('message', 'ملف الصورة مفقود على الخادم، استخدم إعادة الرفع');
});

test('admin can rotate a photo clockwise and gets fresh versioned urls', function () {
  Storage::fake('public');
  $place = Place::factory()->approved()->create();

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

  $response = $this->actingAs(placesAdmin())
    ->postJson("/api/v1/admin/place-photos/{$photo->id}/rotate")
    ->assertOk()
    ->assertJsonPath('id', $photo->id);

  [$width, $height] = getimagesizefromstring(Storage::disk('public')->get($photo->display_path));
  expect($height)->toBe(400)->and($width)->toBe(300);

  [$tw, $th] = getimagesizefromstring(Storage::disk('public')->get($photo->thumb_path));
  expect($tw)->toBe(400)->and($th)->toBe(400);

  expect($response->json('display_url'))->toContain('?v=');
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
