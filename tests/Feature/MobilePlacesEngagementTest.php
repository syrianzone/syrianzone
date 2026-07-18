<?php

use App\Models\Place;
use App\Models\PlaceComment;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

beforeEach(fn () => Cache::flush());

function mobilePlaceEngagementToken(User $user): string
{
    return $user->createToken('mobile:place-engagement-test', ['mobile'])->plainTextToken;
}

function placeEngagementUser(array $attributes = []): User
{
    return User::factory()->create(['role' => 'user', ...$attributes]);
}

test('mobile likes are idempotent and counters change in the same transaction', function () {
    $user = placeEngagementUser();
    $place = Place::factory()->approved()->create();
    $token = mobilePlaceEngagementToken($user);

    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/like")
        ->assertOk()
        ->assertExactJson(['liked' => true, 'likes_count' => 1]);
    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/like")
        ->assertOk()
        ->assertExactJson(['liked' => true, 'likes_count' => 1]);
    expect($place->fresh()->likes_count)->toBe(1);
    $this->assertDatabaseCount('place_likes', 1);

    $this->withToken($token)->deleteJson("/api/v1/places/{$place->id}/like")
        ->assertOk()
        ->assertExactJson(['liked' => false, 'likes_count' => 0]);
    $this->withToken($token)->deleteJson("/api/v1/places/{$place->id}/like")
        ->assertOk()
        ->assertExactJson(['liked' => false, 'likes_count' => 0]);
    expect($place->fresh()->likes_count)->toBe(0);

    $place->forceFill(['likes_count' => 9])->save();
    $this->withToken($token)->deleteJson("/api/v1/places/{$place->id}/like")
        ->assertOk()
        ->assertExactJson(['liked' => false, 'likes_count' => 0]);
    expect($place->fresh()->likes_count)->toBe(0);
});

test('mobile saves are idempotent and my saves is ordered by save time', function () {
    $user = placeEngagementUser();
    $first = Place::factory()->approved()->create();
    $second = Place::factory()->approved()->create();
    $pending = Place::factory()->create();
    $token = mobilePlaceEngagementToken($user);

    $this->withToken($token)->postJson("/api/v1/places/{$first->id}/save")
        ->assertExactJson(['saved' => true, 'saves_count' => 1]);
    $this->travel(1)->second();
    $this->withToken($token)->postJson("/api/v1/places/{$second->id}/save")
        ->assertExactJson(['saved' => true, 'saves_count' => 1]);
    $this->withToken($token)->postJson("/api/v1/places/{$second->id}/save")
        ->assertExactJson(['saved' => true, 'saves_count' => 1]);
    $this->withToken($token)->postJson("/api/v1/places/{$pending->id}/save")->assertNotFound();

    $this->withToken($token)->getJson('/api/v1/my/saves')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $second->id)
        ->assertJsonPath('data.1.id', $first->id);

    $this->withToken($token)->deleteJson("/api/v1/places/{$second->id}/save")
        ->assertExactJson(['saved' => false, 'saves_count' => 0]);
    $this->withToken($token)->deleteJson("/api/v1/places/{$second->id}/save")
        ->assertExactJson(['saved' => false, 'saves_count' => 0]);
    expect($second->fresh()->saves_count)->toBe(0);
});

test('comments expose the native shape and maintain a bounded counter', function () {
    $user = placeEngagementUser();
    $place = Place::factory()->approved()->create();
    $token = mobilePlaceEngagementToken($user);

    $created = $this->withToken($token)->postJson("/api/v1/places/{$place->id}/comments", [
        'body' => 'مكان رائع',
    ])->assertCreated()
        ->assertJsonPath('body', 'مكان رائع')
        ->assertJsonPath('user.id', $user->id)
        ->assertJsonStructure(['id', 'body', 'created_at', 'user' => ['id', 'name', 'avatar_url']]);
    expect($place->fresh()->comments_count)->toBe(1);

    $this->getJson("/api/v1/places/{$place->id}/comments")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $created->json('id'));

    $this->withToken($token)->deleteJson('/api/v1/place-comments/'.$created->json('id'))
        ->assertNoContent();
    expect($place->fresh()->comments_count)->toBe(0);
    $this->assertDatabaseMissing('place_comments', ['id' => $created->json('id')]);
});

test('only a comment owner or mobile administrator can delete a comment', function () {
    $owner = placeEngagementUser();
    $stranger = placeEngagementUser();
    $admin = User::factory()->create(['role' => 'admin']);
    $place = Place::factory()->approved()->create(['comments_count' => 2]);
    $first = PlaceComment::factory()->create(['place_id' => $place->id, 'user_id' => $owner->id]);
    $second = PlaceComment::factory()->create(['place_id' => $place->id]);

    $this->withToken(mobilePlaceEngagementToken($stranger))
        ->deleteJson("/api/v1/place-comments/{$first->id}")
        ->assertForbidden();
    $this->withToken(mobilePlaceEngagementToken($owner))
        ->deleteJson("/api/v1/place-comments/{$first->id}")
        ->assertNoContent();
    $this->withToken(mobilePlaceEngagementToken($admin))
        ->deleteJson("/api/v1/place-comments/{$second->id}")
        ->assertNoContent();
    expect($place->fresh()->comments_count)->toBe(0);
});

test('comment validation and targets are bounded', function () {
    $user = placeEngagementUser();
    $approved = Place::factory()->approved()->create();
    $pending = Place::factory()->create();
    $token = mobilePlaceEngagementToken($user);

    $this->withToken($token)->postJson("/api/v1/places/{$approved->id}/comments", [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('body');
    $this->withToken($token)->postJson("/api/v1/places/{$approved->id}/comments", [
        'body' => str_repeat('x', 501),
    ])->assertUnprocessable()->assertJsonValidationErrors('body');
    $this->withToken($token)->postJson("/api/v1/places/{$approved->id}/comments", [
        'body' => '   ',
    ])->assertUnprocessable()->assertJsonValidationErrors('body');
    $this->withToken($token)->postJson("/api/v1/places/{$pending->id}/comments", [
        'body' => 'تعليق',
    ])->assertNotFound();
    $this->getJson("/api/v1/places/{$pending->id}/comments")->assertNotFound();
});

test('reports are idempotent and accept only declared reasons', function () {
    $user = placeEngagementUser();
    $place = Place::factory()->approved()->create();
    $token = mobilePlaceEngagementToken($user);

    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/report", [
        'reason' => 'spam',
    ])->assertCreated()->assertExactJson(['message' => 'تم استلام البلاغ']);
    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/report", [
        'reason' => 'other',
        'details' => 'بلاغ مكرر',
    ])->assertOk()->assertExactJson(['message' => 'تم استلام بلاغك مسبقاً']);
    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/report", [
        'reason' => 'unknown',
    ])->assertUnprocessable()->assertJsonValidationErrors('reason');

    $this->assertDatabaseCount('place_reports', 1);
    $this->assertDatabaseHas('place_reports', [
        'place_id' => $place->id,
        'user_id' => $user->id,
        'reason' => 'spam',
    ]);
});

test('place engagement write routes reject guests', function () {
    $place = Place::factory()->approved()->create();

    $this->postJson("/api/v1/places/{$place->id}/like")->assertUnauthorized();
    $this->postJson("/api/v1/places/{$place->id}/save")->assertUnauthorized();
    $this->postJson("/api/v1/places/{$place->id}/comments", ['body' => 'تعليق'])->assertUnauthorized();
    $this->postJson("/api/v1/places/{$place->id}/report", ['reason' => 'spam'])->assertUnauthorized();
    $this->getJson('/api/v1/my/saves')->assertUnauthorized();
});

test('comment creation is throttled after ten requests per minute', function () {
    $user = placeEngagementUser();
    $place = Place::factory()->approved()->create();
    $token = mobilePlaceEngagementToken($user);

    foreach (range(1, 10) as $index) {
        $this->withToken($token)->postJson("/api/v1/places/{$place->id}/comments", [
            'body' => "تعليق {$index}",
        ])->assertCreated();
    }

    $this->withToken($token)->postJson("/api/v1/places/{$place->id}/comments", [
        'body' => 'تعليق إضافي',
    ])->assertTooManyRequests();
    expect($place->fresh()->comments_count)->toBe(10);
});
