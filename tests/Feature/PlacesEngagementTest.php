<?php

use App\Models\Place;
use App\Models\PlaceComment;
use App\Models\User;

// UserFactory defaults role to admin; regular users must be explicit.
function engagementUser(array $attrs = []): User {
  return User::factory()->create(array_merge(['role' => 'user'], $attrs));
}

test('like is idempotent and tracks count', function () {
  $user = engagementUser();
  $place = Place::factory()->approved()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/like")
    ->assertOk()
    ->assertJsonPath('liked', true)
    ->assertJsonPath('likes_count', 1);

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/like")
    ->assertOk()
    ->assertJsonPath('likes_count', 1);

  $this->assertDatabaseCount('place_likes', 1);
});

test('unlike removes the like and never drives the count negative', function () {
  $user = engagementUser();
  $place = Place::factory()->approved()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/like");
  $this->actingAs($user)->deleteJson("/api/v1/places/{$place->id}/like")
    ->assertOk()
    ->assertJsonPath('liked', false)
    ->assertJsonPath('likes_count', 0);

  $this->actingAs($user)->deleteJson("/api/v1/places/{$place->id}/like")
    ->assertOk()
    ->assertJsonPath('likes_count', 0);
});

test('save and unsave mirror like semantics', function () {
  $user = engagementUser();
  $place = Place::factory()->approved()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/save")
    ->assertOk()
    ->assertJsonPath('saved', true)
    ->assertJsonPath('saves_count', 1);

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/save")
    ->assertOk()
    ->assertJsonPath('saves_count', 1);

  $this->actingAs($user)->deleteJson("/api/v1/places/{$place->id}/save")
    ->assertOk()
    ->assertJsonPath('saved', false)
    ->assertJsonPath('saves_count', 0);

  $this->actingAs($user)->deleteJson("/api/v1/places/{$place->id}/save")
    ->assertOk()
    ->assertJsonPath('saves_count', 0);
});

test('engagement targets must be approved places', function () {
  $user = engagementUser();
  $pending = Place::factory()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$pending->id}/like")->assertNotFound();
  $this->actingAs($user)->postJson("/api/v1/places/{$pending->id}/save")->assertNotFound();
  $this->actingAs($user)->postJson("/api/v1/places/{$pending->id}/comments", ['body' => 'مرحبا'])->assertNotFound();
  $this->actingAs($user)->postJson("/api/v1/places/{$pending->id}/report", ['reason' => 'spam'])->assertNotFound();
  $this->getJson("/api/v1/places/{$pending->id}/comments")->assertNotFound();
});

test('guests get 401 on engagement writes', function () {
  $place = Place::factory()->approved()->create();

  $this->postJson("/api/v1/places/{$place->id}/like")->assertUnauthorized();
  $this->deleteJson("/api/v1/places/{$place->id}/like")->assertUnauthorized();
  $this->postJson("/api/v1/places/{$place->id}/save")->assertUnauthorized();
  $this->postJson("/api/v1/places/{$place->id}/comments", ['body' => 'مرحبا'])->assertUnauthorized();
  $this->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])->assertUnauthorized();
  $this->getJson('/api/v1/my/saves')->assertUnauthorized();
});

test('my saves lists only approved places the user saved', function () {
  $user = engagementUser();
  $saved = Place::factory()->approved()->create();
  Place::factory()->approved()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$saved->id}/save");

  $this->actingAs($user)->getJson('/api/v1/my/saves')
    ->assertOk()
    ->assertJsonCount(1, 'data')
    ->assertJsonPath('data.0.id', $saved->id);
});

test('can list comments newest first', function () {
  $place = Place::factory()->approved()->create();
  PlaceComment::factory()->create(['place_id' => $place->id, 'created_at' => now()->subHour()]);
  $latest = PlaceComment::factory()->create(['place_id' => $place->id]);

  $this->getJson("/api/v1/places/{$place->id}/comments")
    ->assertOk()
    ->assertJsonCount(2, 'data')
    ->assertJsonPath('data.0.id', $latest->id)
    ->assertJsonStructure(['data' => [['id', 'body', 'created_at', 'user' => ['id', 'name', 'avatar_url']]]]);
});

test('comments listing still works after a commenter soft-deletes their account', function () {
  $place = Place::factory()->approved()->create();
  $commenter = engagementUser();
  PlaceComment::factory()->create(['place_id' => $place->id, 'user_id' => $commenter->id]);
  $commenter->delete();

  $this->getJson("/api/v1/places/{$place->id}/comments")
    ->assertOk()
    ->assertJsonCount(1, 'data')
    ->assertJsonPath('data.0.user.id', $commenter->id);
});

test('can add a comment', function () {
  $user = engagementUser();
  $place = Place::factory()->approved()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/comments", ['body' => 'مكان رائع'])
    ->assertCreated()
    ->assertJsonPath('body', 'مكان رائع')
    ->assertJsonPath('user.id', $user->id);

  expect($place->fresh()->comments_count)->toBe(1);
});

test('comment body is required and capped at 500', function () {
  $user = engagementUser();
  $place = Place::factory()->approved()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/comments", [])->assertStatus(422);
  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/comments", ['body' => str_repeat('a', 501)])->assertStatus(422);
});

test('banned user cannot comment', function () {
  $place = Place::factory()->approved()->create();

  $this->actingAs(engagementUser(['is_banned' => true]))
    ->postJson("/api/v1/places/{$place->id}/comments", ['body' => 'مرحبا'])
    ->assertForbidden();
});

test('owner can delete own comment, stranger cannot, admin can', function () {
  $owner = engagementUser();
  $place = Place::factory()->approved()->create(['comments_count' => 2]);
  $mine = PlaceComment::factory()->create(['place_id' => $place->id, 'user_id' => $owner->id]);
  $other = PlaceComment::factory()->create(['place_id' => $place->id]);

  $this->actingAs($owner)->deleteJson("/api/v1/place-comments/{$other->id}")->assertForbidden();

  $this->actingAs($owner)->deleteJson("/api/v1/place-comments/{$mine->id}")->assertNoContent();
  $this->assertDatabaseMissing('place_comments', ['id' => $mine->id]);
  expect($place->fresh()->comments_count)->toBe(1);

  $this->actingAs(User::factory()->create(['role' => 'admin']))
    ->deleteJson("/api/v1/place-comments/{$other->id}")
    ->assertNoContent();
});

test('comments are throttled after 10 per minute', function () {
  $user = engagementUser();
  $place = Place::factory()->approved()->create();

  foreach (range(1, 10) as $i) {
    $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/comments", ['body' => "تعليق {$i}"])->assertCreated();
  }
  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/comments", ['body' => 'زيادة'])->assertStatus(429);
});

test('can report a place once, repeat is idempotent', function () {
  $user = engagementUser();
  $place = Place::factory()->approved()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])
    ->assertCreated()
    ->assertJsonPath('message', 'تم استلام البلاغ');

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'other', 'details' => 'مكرر'])
    ->assertOk()
    ->assertJsonPath('message', 'تم استلام بلاغك مسبقاً');

  $this->assertDatabaseCount('place_reports', 1);
  $this->assertDatabaseHas('place_reports', ['place_id' => $place->id, 'user_id' => $user->id, 'reason' => 'spam']);
});

test('report reason must be a known value', function () {
  $place = Place::factory()->approved()->create();

  $this->actingAs(engagementUser())
    ->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'bogus'])
    ->assertStatus(422);
});

test('banned user cannot report', function () {
  $place = Place::factory()->approved()->create();

  $this->actingAs(engagementUser(['is_banned' => true]))
    ->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])
    ->assertForbidden();
});
