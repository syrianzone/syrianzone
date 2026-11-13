<?php

use App\Models\User;

test('guests cannot write user settings', function () {
  $this->postJson('/api/user/settings', ['settings' => ['governorate' => 'aleppo']])->assertUnauthorized();
});

test('user settings accept the sync keys', function () {
  $user = User::factory()->create();

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

test('every key of the AccountSettingsPatch contract is persisted', function () {
  // Mirrors `AccountSettingsPatch` in
  // resources/js/Domain/settings/accountSettings.ts. Laravel returns only
  // validated keys, so a preference that TS can send but this validator does
  // not list is dropped with a 200 — silent data loss. Add the key here when
  // you add it there.
  $patch = [
    'theme' => 'jasmine',
    'fontFamily' => 'system',
    'governorate' => 'aleppo',
    'eventsGovernorate' => 'homs',
    'showWeather' => true,
    'showPrayerTimes' => false,
    'showEvents' => true,
    'useCustomCoords' => false,
    'customLat' => 33.5,
    'customLon' => 36.3,
    'customLinks' => [['id' => 'link-1', 'url' => 'https://example.com', 'name' => 'Example']],
    'muslimCity' => 'homs',
    'muslimMethod' => 3,
    'muslimUseCustomCoords' => true,
    'muslimLat' => 34.7,
    'muslimLon' => 36.7,
    'prayerLog' => ['2026-09-10' => ['Fajr' => true]],
    'quranLastPage' => 42,
    'quranLastJuz' => 3,
    'quranPageAt' => 1789000000,
    'quranReciterId' => 'husary',
    'quranRadioBytes' => 1024,
    'quranRadioSeconds' => 60,
  ];

  $user = User::factory()->create();

  $response = $this->actingAs($user)
    ->postJson('/api/user/settings', ['settings' => $patch])
    ->assertOk();

  $stored = $user->fresh()->settings;

  foreach ($patch as $key => $value) {
    // toEqual: validation reorders the keys inside customLinks, not the values.
    expect($response->json("settings.{$key}"))->toEqual($value)
      ->and($stored[$key] ?? null)->toEqual($value);
  }
});

test('the six vestigial preference keys are no longer part of the contract', function () {
  // clockFormat / showClock / searchEngine / customSearchUrl / showSearch /
  // language belonged to the home clock and site-search widgets, both removed.
  $user = User::factory()->create();

  $response = $this->actingAs($user)->postJson('/api/user/settings', ['settings' => [
    'clockFormat' => '24',
    'showClock' => true,
    'searchEngine' => 'google',
    'customSearchUrl' => 'https://www.google.com/search?q=',
    'showSearch' => true,
    'language' => 'en',
  ]])->assertOk();

  foreach (['clockFormat', 'showClock', 'searchEngine', 'customSearchUrl', 'showSearch', 'language'] as $key) {
    $response->assertJsonMissingPath("settings.{$key}");
    expect($user->fresh()->settings)->not->toHaveKey($key);
  }
});

test('a bearer token is enough on the legacy session-or-token mount', function () {
  $user = User::factory()->create();
  $token = $user->createToken('mobile')->plainTextToken;

  $this->withHeader('Authorization', 'Bearer '.$token)
    ->postJson('/api/user/settings', ['settings' => ['governorate' => 'hama']])
    ->assertOk()
    ->assertJsonPath('settings.governorate', 'hama');
});

test('user settings reject oversized or invalid sync payloads', function () {
  $user = User::factory()->create();

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
