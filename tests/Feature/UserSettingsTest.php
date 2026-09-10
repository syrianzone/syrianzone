<?php

use App\Models\User;

test('guests cannot write user settings', function () {
  $this->postJson('/api/user/settings', ['settings' => ['governorate' => 'aleppo']])->assertUnauthorized();
});

test('user settings accept the sync keys', function () {
  $user = User::factory()->create(['role' => 'user']);

  $this->actingAs($user)->postJson('/api/user/settings', ['settings' => [
    'governorate' => 'aleppo',
    'eventsGovernorate' => 'homs',
    'muslimCity' => 'homs',
    'muslimMethod' => 5,
    'muslimUseCustomCoords' => false,
    'prayerLog' => ['2026-09-10' => ['Fajr' => true, 'Isha' => false]],
    'quranLastPage' => 42,
    'quranPageAt' => 1789000000,
    'quranReciterId' => 'husary',
  ]])->assertOk()->assertJsonPath('settings.governorate', 'aleppo');

  expect($user->fresh()->settings['prayerLog'])->toBe(['2026-09-10' => ['Fajr' => true, 'Isha' => false]])
    ->and($user->fresh()->settings['quranPageAt'])->toBe(1789000000);
});

test('user settings merge instead of replacing', function () {
  $user = User::factory()->create(['role' => 'user', 'settings' => ['theme' => 'dark']]);

  $this->actingAs($user)->postJson('/api/user/settings', ['settings' => ['governorate' => 'hama']])->assertOk();

  expect($user->fresh()->settings)->toMatchArray(['theme' => 'dark', 'governorate' => 'hama']);
});

test('user settings reject oversized or invalid sync payloads', function () {
  $user = User::factory()->create(['role' => 'user']);

  // unknown method + out-of-range page
  $this->actingAs($user)->postJson('/api/user/settings', ['settings' => ['muslimMethod' => 6]])->assertStatus(422);
  $this->actingAs($user)->postJson('/api/user/settings', ['settings' => ['quranLastPage' => 605]])->assertStatus(422);

  // prayer log capped at 31 days
  $log = [];
  for ($i = 0; $i < 32; $i++) {
    $log[sprintf('2026-08-%02d', $i + 1)] = ['Fajr' => true];
  }
  $this->actingAs($user)->postJson('/api/user/settings', ['settings' => ['prayerLog' => $log]])->assertStatus(422);
});
