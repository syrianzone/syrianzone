<?php

use App\Models\Poll;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/*
| Where a canonical and a legacy URL are served by one controller action in
| routes/api.php, these tests only assert that each URL answers what it should.
| Payload equality between two URLs is not asserted: they run the same method,
| so it cannot drift, and an assertion on it would only pin the second mount.
*/

test('transit reads answer on the canonical /api/v1/transit prefix and at the root of /api/v1', function () {
    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    seedCity('homs', ['name_ar' => 'حمص', 'name_en' => 'Homs']);
    Cache::forget('transit:cities:api');
    Cache::forget('transit:routes:homs');
    Cache::forget('transit:map-data:homs');

    foreach (['/api/v1/transit/cities', '/api/v1/cities'] as $path) {
        $this->getJson($path)->assertOk()->assertJsonFragment(['id' => 'homs']);
    }

    foreach (['/api/v1/transit/cities/homs/routes', '/api/v1/cities/homs/routes'] as $path) {
        $this->getJson($path)->assertOk();
    }

    foreach (['/api/v1/transit/cities/homs/map', '/api/v1/transit/cities/homs/map-data', '/api/v1/cities/homs/map-data'] as $path) {
        $this->getJson($path)->assertOk();
    }

    foreach (['/api/v1/transit/search?q=', '/api/v1/search?q='] as $path) {
        $this->getJson($path)->assertOk()->assertJson(['routes' => [], 'stops' => []]);
    }
});

test('canonical /api/v1/transit/pois and legacy /api/v1/geo/poi both validate and serve POI search', function () {
    Http::fake([
        'photon.komoot.io/*' => Http::response([
            'features' => [photonFeature('جامع خالد بن الوليد', 'place_of_worship', 36.71, 34.73)],
        ], 200),
    ]);

    $this->getJson('/api/v1/transit/pois?q=ab')->assertStatus(422);
    $this->getJson('/api/v1/geo/poi?q=ab')->assertStatus(422);

    $canonical = $this->getJson('/api/v1/transit/pois?q=جامع')->assertOk()->json();
    $legacy = $this->getJson('/api/v1/geo/poi?q=جامع')->assertOk()->json();
    expect($canonical['places'])->toHaveCount(1)
        ->and($legacy['places'])->toHaveCount(1);
});

test('canonical /api/v1/search/global and legacy /api/v1/global-search both serve cross-module results', function () {
    $canonical = $this->getJson('/api/v1/search/global?q=a')->assertOk()->json();
    $legacy = $this->getJson('/api/v1/global-search?q=a')->assertOk()->json();

    $keys = ['routes', 'places', 'phonebook', 'officials', 'govapps'];
    expect($canonical)->toHaveKeys($keys)
        ->and($legacy)->toHaveKeys($keys);
});

test('canonical /api/v1/polls/{idOrSlug}/ballots and /api/v1/polls/{idOrSlug}/leaderboard work alongside legacy poll endpoints', function () {
    $poll = Poll::create([
        'id' => '00000000-0000-0000-0000-000000000099',
        'title' => 'Standard Poll',
        'slug' => 'standard-poll',
        'timezone' => 'Europe/Amsterdam',
        'is_active' => true,
    ]);

    $this->getJson("/api/v1/polls/{$poll->slug}/leaderboard")
        ->assertOk()
        ->assertJsonPath('poll.slug', 'standard-poll');

    $this->postJson("/api/v1/polls/{$poll->slug}/ballots", [
        'tiers' => ['S' => ['c1']],
        'deviceId' => '1234567890',
    ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'يجب اختيار 3 مرشحين على الأقل.');
});

test('the atlas answers under /api/v1/atlas and the legacy /api/population/master', function () {
    foreach (['/api/v1/atlas', '/api/population/master'] as $path) {
        $this->getJson($path)
            ->assertOk()
            ->assertJsonStructure(['groups', 'rainfall_data']);
    }

    $this->getJson('/api/v1/app-icon?store=invalid')
        ->assertStatus(400)
        ->assertJsonPath('message', 'المتجر غير مدعوم.')
        ->assertJsonPath('icon', null);
});

test('canonical /api/v1/user/settings and /api/v1/account routes work for authenticated users', function () {
    $user = User::factory()->create(['name' => 'Initial Name']);

    $this->actingAs($user)
        ->patchJson('/api/v1/user/settings', [
            'settings' => ['theme' => 'dark', 'language' => 'ar'],
        ])
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('settings.theme', 'dark');

    $this->actingAs($user)
        ->patchJson('/api/v1/account', [
            'name' => 'Updated Name',
            'email' => $user->email,
        ])
        ->assertRedirect();

    expect($user->fresh()->name)->toBe('Updated Name');
});
