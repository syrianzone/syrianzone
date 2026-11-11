<?php

use App\Models\Place;
use App\Models\PlaceReport;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\Cache;

// UserFactory defaults role to admin; regular users must be explicit.
function reporter(array $attrs = []): User {
  return User::factory()->create(array_merge(['role' => 'user'], $attrs));
}

function reportsAdmin(): User {
  return User::factory()->create(['role' => 'user', 'permissions' => PermissionCatalogue::forModule('places')]);
}

test('a signed-in user can report an approved place once', function () {
  $user = reporter();
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
  $user = reporter();
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
  $this->actingAs(reporter(['is_banned' => true]))
    ->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])
    ->assertForbidden();
});

test('report moderation endpoints require places permissions', function () {
  $user = reporter();

  $this->actingAs($user)->getJson('/api/v1/admin/place-reports')->assertForbidden();
  $this->actingAs($user)->postJson('/api/v1/admin/place-reports/1/resolve', ['action' => 'dismiss'])->assertForbidden();
});

test('admin lists open reports and can dismiss one', function () {
  $place = Place::factory()->approved()->create();
  $report = PlaceReport::create(['place_id' => $place->id, 'user_id' => reporter()->id, 'reason' => 'spam']);
  $admin = reportsAdmin();

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
  $first = PlaceReport::create(['place_id' => $place->id, 'user_id' => reporter()->id, 'reason' => 'inappropriate']);
  $second = PlaceReport::create(['place_id' => $place->id, 'user_id' => reporter()->id, 'reason' => 'spam']);
  Cache::put('places:map', ['stale'], 60);

  $this->actingAs(reportsAdmin())
    ->postJson("/api/v1/admin/place-reports/{$first->id}/resolve", ['action' => 'unpublish'])
    ->assertOk()
    ->assertJsonPath('status', 'resolved');

  expect($place->fresh())->status->toBe('pending')->approved_at->toBeNull();
  expect($second->fresh()->status)->toBe('resolved');
  expect(Cache::has('places:map'))->toBeFalse();
});
