<?php

use App\Models\Place;
use App\Models\User;

// UserFactory defaults role to admin; regular users must be explicit.
function engagementUser(array $attrs = []): User
{
    return User::factory()->create(array_merge(['role' => 'user'], $attrs));
}

test('save and unsave are idempotent and track the count', function () {
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

    $this->actingAs($user)->postJson("/api/v1/places/{$pending->id}/save")->assertNotFound();
});

test('guests get 401 on engagement writes', function () {
    $place = Place::factory()->approved()->create();

    $this->postJson("/api/v1/places/{$place->id}/save")->assertUnauthorized();
    $this->deleteJson("/api/v1/places/{$place->id}/save")->assertUnauthorized();
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

test('my saves orders by save time not place age', function () {
    $user = engagementUser();
    $older = Place::factory()->approved()->create(['created_at' => now()->subDay()]);
    $newer = Place::factory()->approved()->create();

    $this->actingAs($user)->postJson("/api/v1/places/{$newer->id}/save");
    $this->travel(1)->minutes();
    $this->actingAs($user)->postJson("/api/v1/places/{$older->id}/save");

    $this->actingAs($user)->getJson('/api/v1/my/saves')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $older->id)
        ->assertJsonPath('data.1.id', $newer->id);
});

test('removed engagement endpoints are gone', function () {
    $user = engagementUser();
    $admin = User::factory()->create(['role' => 'admin']);
    $place = Place::factory()->approved()->create();

    $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/like")->assertNotFound();
    $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/comments", ['body' => 'مرحبا'])->assertNotFound();
    $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])->assertNotFound();
    $this->actingAs($user)->getJson("/api/v1/places/{$place->id}/comments")->assertNotFound();
    $this->actingAs($admin)->getJson('/api/v1/admin/place-reports')->assertNotFound();
});
