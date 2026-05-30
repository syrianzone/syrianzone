<?php

use App\Models\StaticSite;
use App\Models\User;

test('guest sees only visible sites', function () {
    StaticSite::factory()->create(['is_visible' => true]);
    StaticSite::factory()->create(['is_visible' => false]);

    $this->getJson('/sites')->assertOk()->assertJsonCount(1);
});

test('authenticated user sees all sites', function () {
    StaticSite::factory()->create(['is_visible' => true]);
    StaticSite::factory()->create(['is_visible' => false]);

    $this->actingAs(User::factory()->create())
        ->getJson('/sites')
        ->assertOk()
        ->assertJsonCount(2);
});

test('authenticated user can create site', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/sites', ['name' => 'Test', 'slug' => 'test', 'path' => '/test'])
        ->assertCreated()
        ->assertJsonPath('slug', 'test');
});

test('authenticated user can update site', function () {
    $site = StaticSite::factory()->create();

    $this->actingAs(User::factory()->create())
        ->putJson("/sites/{$site->id}", ['name' => 'Updated'])
        ->assertOk()
        ->assertJsonPath('name', 'Updated');
});

test('authenticated user can delete site', function () {
    $site = StaticSite::factory()->create();

    $this->actingAs(User::factory()->create())
        ->deleteJson("/sites/{$site->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('static_sites', ['id' => $site->id]);
});
