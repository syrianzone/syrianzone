<?php

use App\Models\User;

test('guests cannot report radio usage', function () {
  $this->postJson('/api/user/radio-usage', ['seconds' => 30, 'bytes' => 480000])->assertUnauthorized();
});

test('radio usage deltas accumulate rather than overwrite', function () {
  $user = User::factory()->create(['role' => 'user']);

  // The client sends a delta because the counter spans devices: a total would
  // be last-write-wins, so a second phone reporting would erase the first.
  $this->actingAs($user)->postJson('/api/user/radio-usage', ['seconds' => 30, 'bytes' => 480000])
    ->assertOk()
    ->assertJsonPath('totals', ['bytes' => 480000, 'seconds' => 30]);

  $this->actingAs($user)->postJson('/api/user/radio-usage', ['seconds' => 45, 'bytes' => 720000])
    ->assertOk()
    ->assertJsonPath('totals', ['bytes' => 1200000, 'seconds' => 75]);

  expect($user->fresh()->settings)
    ->toMatchArray(['quranRadioBytes' => 1200000, 'quranRadioSeconds' => 75]);
});

test('radio usage rejects fractional, negative and missing counters', function () {
  $user = User::factory()->create(['role' => 'user']);

  // Fractional seconds come from wall-clock accrual; the client rounds, and a
  // value that slips through must not silently corrupt the total.
  $this->actingAs($user)->postJson('/api/user/radio-usage', ['seconds' => 15.5, 'bytes' => 240000])->assertStatus(422);
  $this->actingAs($user)->postJson('/api/user/radio-usage', ['seconds' => -5, 'bytes' => 240000])->assertStatus(422);
  $this->actingAs($user)->postJson('/api/user/radio-usage', ['seconds' => 15])->assertStatus(422);
  $this->actingAs($user)->postJson('/api/user/radio-usage', ['bytes' => 240000])->assertStatus(422);

  expect($user->fresh()->settings)->toBeNull();
});

test('clearing radio usage zeroes the counters', function () {
  $user = User::factory()->create([
    'role' => 'user',
    'settings' => ['theme' => 'dark', 'quranRadioBytes' => 1200000, 'quranRadioSeconds' => 75],
  ]);

  $this->actingAs($user)->postJson('/api/user/radio-usage/clear')
    ->assertOk()
    ->assertJsonPath('totals', ['bytes' => 0, 'seconds' => 0]);

  // Only the counters are cleared; the rest of the settings blob is untouched.
  expect($user->fresh()->settings)
    ->toMatchArray(['theme' => 'dark', 'quranRadioBytes' => 0, 'quranRadioSeconds' => 0]);
});

test('the settings endpoint also accepts the radio usage keys', function () {
  $user = User::factory()->create(['role' => 'user']);

  $this->actingAs($user)->postJson('/api/user/settings', ['settings' => [
    'quranRadioBytes' => 1200,
    'quranRadioSeconds' => 60,
  ]])->assertOk()->assertJsonPath('settings.quranRadioBytes', 1200);

  $this->actingAs($user)->postJson('/api/user/settings', ['settings' => ['quranRadioSeconds' => -1]])->assertStatus(422);
});
