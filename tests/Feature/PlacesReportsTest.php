<?php

use App\Models\Place;
use App\Models\PlaceReport;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

test('a signed-in user can report an approved place once', function () {
  $user = User::factory()->create();
  $place = Place::factory()->approved()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'inappropriate', 'details' => 'صور مسيئة'])
    ->assertCreated();

  $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])
    ->assertOk();

  expect(PlaceReport::count())->toBe(1);
  expect(PlaceReport::first())
    ->reason->toBe('inappropriate')
    ->status->toBe('open');
});

test('reports validate the reason and target only approved places', function () {
  $user = User::factory()->create();
  $approved = Place::factory()->approved()->create();
  $pending = Place::factory()->create();

  $this->actingAs($user)->postJson("/api/v1/places/{$approved->id}/report", ['reason' => 'nope'])
    ->assertUnprocessable()->assertJsonValidationErrors('reason');
  $this->actingAs($user)->postJson("/api/v1/places/{$pending->id}/report", ['reason' => 'spam'])
    ->assertNotFound();
});

test('guests and banned users cannot report', function () {
  $place = Place::factory()->approved()->create();

  $this->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])->assertUnauthorized();
  $this->actingAs(User::factory()->create(['is_banned' => true]))
    ->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])
    ->assertForbidden();
});

test('report moderation endpoints require places permissions', function () {
  $user = User::factory()->create();

  $this->actingAs($user)->getJson('/api/v1/admin/place-reports')->assertForbidden();
  $this->actingAs($user)->postJson('/api/v1/admin/place-reports/1/resolve', ['action' => 'dismiss'])->assertForbidden();
});

test('admin lists open reports and can dismiss one', function () {
  $place = Place::factory()->approved()->create();
  $report = PlaceReport::create(['place_id' => $place->id, 'user_id' => User::factory()->create()->id, 'reason' => 'spam']);
  $admin = moduleStaff('places');

  $this->actingAs($admin)->getJson('/api/v1/admin/place-reports')
    ->assertOk()
    ->assertJsonCount(1, 'data')
    ->assertJsonPath('data.0.place.id', $place->id);

  $this->actingAs($admin)->postJson("/api/v1/admin/place-reports/{$report->id}/resolve", ['action' => 'dismiss'])
    ->assertOk()
    ->assertJsonPath('status', 'dismissed');

  expect($place->fresh()->status)->toBe('approved');
  $this->actingAs($admin)->getJson('/api/v1/admin/place-reports')->assertJsonCount(0, 'data');
});

test('upholding a report unpublishes the place and closes its open reports', function () {
  $place = Place::factory()->approved()->create();
  $first = PlaceReport::create(['place_id' => $place->id, 'user_id' => User::factory()->create()->id, 'reason' => 'inappropriate']);
  $second = PlaceReport::create(['place_id' => $place->id, 'user_id' => User::factory()->create()->id, 'reason' => 'spam']);
  Cache::put('places:map', ['stale'], 60);

  $this->actingAs(moduleStaff('places'))
    ->postJson("/api/v1/admin/place-reports/{$first->id}/resolve", ['action' => 'unpublish'])
    ->assertOk()
    ->assertJsonPath('status', 'resolved');

  expect($place->fresh())->status->toBe('pending')->approved_at->toBeNull();
  expect($second->fresh()->status)->toBe('resolved');
  expect(Cache::has('places:map'))->toBeFalse();
});

test('closed reports cannot be acted on again', function () {
  $place = Place::factory()->approved()->create();
  $report = PlaceReport::create(['place_id' => $place->id, 'user_id' => User::factory()->create()->id, 'reason' => 'spam', 'status' => 'resolved']);

  $this->actingAs(moduleStaff('places'))
    ->postJson("/api/v1/admin/place-reports/{$report->id}/resolve", ['action' => 'unpublish'])
    ->assertStatus(409);
  $this->actingAs(moduleStaff('places'))
    ->postJson("/api/v1/admin/place-reports/{$report->id}/resolve", ['action' => 'dismiss'])
    ->assertStatus(409);

  expect($place->fresh()->status)->toBe('approved');
  expect($report->fresh()->status)->toBe('resolved');
});
