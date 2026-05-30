<?php

use App\Models\Contributor;

test('can list contributors', function () {
    Contributor::factory()->count(5)->create();

    $this->getJson('/api/contributors')
        ->assertOk()
        ->assertJsonPath('data', fn($data) => count($data) === 5);
});

test('contributors ordered by total contributions', function () {
    Contributor::factory()->create(['total_contributions' => 10]);
    Contributor::factory()->create(['total_contributions' => 50]);
    Contributor::factory()->create(['total_contributions' => 30]);

    $response = $this->getJson('/api/contributors')->assertOk();

    expect($response->json('data.0.total_contributions'))->toBe(50);
    expect($response->json('data.1.total_contributions'))->toBe(30);
});

test('can show contributor', function () {
    $contributor = Contributor::factory()->create();

    $this->getJson("/api/contributors/{$contributor->id}")
        ->assertOk()
        ->assertJsonPath('id', $contributor->id);
});
