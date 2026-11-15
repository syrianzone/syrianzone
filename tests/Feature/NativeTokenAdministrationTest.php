<?php

use App\Models\User;

beforeEach(function () { $this->withoutVite(); });

test('trusted mobile accounts manage their own agent tokens without granting another account permissions', function () {
    $owner = capabilityUser('places.review');
    $other = capabilityUser('places.review');
    $token = $owner->createToken('iPhone', ['mobile'])->plainTextToken;
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->get('/admin/api-tokens')->assertOk();
    $created = $this->postJson('/api/v1/admin/api-tokens', [
        'name' => 'Local test', 'ttl' => '7d', 'permissions' => ['places.review', 'polls.delete'],
    ])->assertCreated()->assertJsonPath('abilities', ['places.review'])->assertJsonPath('dropped', ['polls.delete']);
    $this->postJson('/api/v1/admin/api-tokens', [
        'user_id' => $other->id, 'name' => 'Forbidden owner', 'ttl' => '7d', 'permissions' => ['places.review'],
    ])->assertForbidden();
    $issued = $owner->tokens()->where('name', 'Local test')->firstOrFail();
    expect($created->json('plain_text_token'))->toBeString();
    $this->deleteJson('/api/v1/admin/api-tokens/'.$issued->id)->assertOk();
    expect($issued->fresh())->toBeNull();
    expect($owner->tokens()->where('name', 'iPhone')->exists())->toBeTrue();
});

test('scoped and wildcard agent tokens cannot create or read credentials through mobile administration', function (array $abilities) {
    $owner = User::factory()->create(['role' => 'superadmin']);
    $token = $owner->createToken('Agent', $abilities)->plainTextToken;
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id, 'name' => 'Forbidden escalation', 'ttl' => '7d', 'permissions' => ['places.review'],
        ])->assertForbidden();
    $this->getJson('/admin/api-tokens')->assertForbidden();
    expect($owner->tokens()->count())->toBe(1);
})->with([[['places.review']], [['*']]]);

test('mobile sessions cannot administer tokens after their owner is banned', function () {
    $owner = capabilityUser('places.review');
    $token = $owner->createToken('iPhone', ['mobile'])->plainTextToken;
    $owner->update(['is_banned' => true]);
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/admin/api-tokens')->assertForbidden();
});
