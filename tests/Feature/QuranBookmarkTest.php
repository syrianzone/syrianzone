<?php

use App\Models\User;

function muslimUser(array $attrs = []): User
{
  return User::factory()->create(array_merge(['role' => 'user'], $attrs));
}

test('guests cannot manage quran bookmarks', function () {
  $this->postJson('/api/v1/quran-bookmarks', ['surah' => 2, 'ayah' => 255, 'page' => 42, 'juz' => 3])->assertUnauthorized();
  $this->getJson('/api/v1/quran-bookmarks')->assertUnauthorized();
  $this->deleteJson('/api/v1/quran-bookmarks/2/255')->assertUnauthorized();
});

test('user can bookmark an ayah and list it', function () {
  $user = muslimUser();

  $this->actingAs($user)
    ->postJson('/api/v1/quran-bookmarks', ['surah' => 112, 'ayah' => 1, 'page' => 604, 'juz' => 30])
    ->assertOk()
    ->assertJson(['saved' => true, 'surah' => 112, 'ayah' => 1]);

  $this->actingAs($user)
    ->getJson('/api/v1/quran-bookmarks')
    ->assertOk()
    ->assertJsonPath('bookmarks.0.surah', 112)
    ->assertJsonPath('bookmarks.0.ayah', 1)
    ->assertJsonPath('bookmarks.0.page', 604);
});

test('bookmarking the same ayah twice stays a single row', function () {
  $user = muslimUser();

  $payload = ['surah' => 2, 'ayah' => 6, 'page' => 3, 'juz' => 1];
  $this->actingAs($user)->postJson('/api/v1/quran-bookmarks', $payload)->assertOk();
  $this->actingAs($user)->postJson('/api/v1/quran-bookmarks', $payload)->assertOk();

  expect(\App\Models\QuranBookmark::where('user_id', $user->id)->count())->toBe(1);
});

test('user can remove a bookmark', function () {
  $user = muslimUser();

  $this->actingAs($user)->postJson('/api/v1/quran-bookmarks', ['surah' => 2, 'ayah' => 100, 'page' => 15, 'juz' => 1])->assertOk();
  $this->actingAs($user)->deleteJson('/api/v1/quran-bookmarks/2/100')->assertOk()->assertJson(['saved' => false]);

  $this->actingAs($user)->getJson('/api/v1/quran-bookmarks')->assertJson(['bookmarks' => []]);
});

test('surah and ayah bounds are validated', function () {
  $user = muslimUser();

  $this->actingAs($user)->postJson('/api/v1/quran-bookmarks', ['surah' => 0, 'ayah' => 1, 'page' => 1, 'juz' => 1])->assertStatus(422);
  $this->actingAs($user)->postJson('/api/v1/quran-bookmarks', ['surah' => 115, 'ayah' => 1, 'page' => 1, 'juz' => 1])->assertStatus(422);
  $this->actingAs($user)->postJson('/api/v1/quran-bookmarks', ['surah' => 2, 'ayah' => 287, 'page' => 1, 'juz' => 1])->assertStatus(422);
  $this->actingAs($user)->deleteJson('/api/v1/quran-bookmarks/2/287')->assertNotFound();
});

test('bookmarks are scoped per user', function () {
  $a = muslimUser();
  $b = muslimUser();

  $this->actingAs($a)->postJson('/api/v1/quran-bookmarks', ['surah' => 2, 'ayah' => 20, 'page' => 4, 'juz' => 1])->assertOk();
  $this->actingAs($b)->getJson('/api/v1/quran-bookmarks')->assertJson(['bookmarks' => []]);
});
