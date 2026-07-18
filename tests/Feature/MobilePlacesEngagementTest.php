<?php

use App\Models\Place;
use App\Models\PlaceSave;
use App\Models\User;

function mobilePlaceEngagementToken(User $user): string
{
    return $user->createToken('mobile:place-engagement-test', ['mobile'])->plainTextToken;
}

function mobilePlaceEngagementUser(): User
{
    return User::factory()->create(['role' => 'user']);
}

test('mobile saves are idempotent and repair a stale counter', function () {
    $user = mobilePlaceEngagementUser();
    $place = Place::factory()->approved()->create(['saves_count' => 9]);
    PlaceSave::create(['place_id' => $place->id, 'user_id' => $user->id]);
    $token = mobilePlaceEngagementToken($user);

    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/save")
        ->assertExactJson(['saved' => true, 'saves_count' => 1]);
    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/save")
        ->assertExactJson(['saved' => true, 'saves_count' => 1]);
    expect($place->fresh()->saves_count)->toBe(1);

    $this->withToken($token)->deleteJson("/api/v1/places/{$place->id}/save")
        ->assertExactJson(['saved' => false, 'saves_count' => 0]);
    $this->withToken($token)->deleteJson("/api/v1/places/{$place->id}/save")
        ->assertExactJson(['saved' => false, 'saves_count' => 0]);
});

test('stateful sessions and mobile tokens share the same saved places endpoint', function () {
    $user = mobilePlaceEngagementUser();
    $place = Place::factory()->approved()->create();

    $this->actingAs($user)->postJson("/api/v1/places/{$place->id}/save")->assertOk();
    $this->withToken(mobilePlaceEngagementToken($user))->getJson('/api/v1/my/saves')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $place->id);
});

test('save routes reject wildcard tokens and unpublished places', function () {
    $user = mobilePlaceEngagementUser();
    $pending = Place::factory()->create();
    $wildcard = $user->createToken('browser-session', ['*'])->plainTextToken;

    $this->withToken($wildcard)->getJson('/api/v1/my/saves')->assertUnauthorized();
    $this->withToken(mobilePlaceEngagementToken($user))
        ->postJson("/api/v1/places/{$pending->id}/save")
        ->assertNotFound();
});

test('removed mobile engagement endpoints stay absent', function () {
    $user = mobilePlaceEngagementUser();
    $admin = User::factory()->create(['role' => 'admin']);
    $place = Place::factory()->approved()->create();
    $token = mobilePlaceEngagementToken($user);

    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/like")->assertNotFound();
    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/comments", ['body' => 'مرحبا'])->assertNotFound();
    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])->assertNotFound();
    $this->withToken($token)->getJson("/api/v1/places/{$place->id}/comments")->assertNotFound();
    $this->withToken(mobilePlaceEngagementToken($admin))->getJson('/api/v1/admin/place-reports')->assertNotFound();
});
