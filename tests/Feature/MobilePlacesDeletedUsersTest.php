<?php

use App\Models\Place;
use App\Models\PlaceComment;
use App\Models\PlaceReport;
use App\Models\User;

function deletedPlacesBearer(User $user, string $name): string
{
    return $user->createToken($name, ['mobile'])->plainTextToken;
}

test('place presenters keep public content safe after self and administrator account deletion', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $owner = User::factory()->create([
        'avatar_url' => 'https://accounts.example.test/owner.png',
        'email' => 'place-owner@example.test',
        'name' => 'Private Place Owner',
        'role' => 'user',
    ]);
    $reporter = User::factory()->create([
        'avatar_url' => 'https://accounts.example.test/reporter.png',
        'email' => 'place-reporter@example.test',
        'name' => 'Private Place Reporter',
        'role' => 'user',
    ]);
    $place = Place::factory()->approved()->create([
        'comments_count' => 1,
        'user_id' => $owner->id,
    ]);
    $comment = PlaceComment::factory()->create([
        'place_id' => $place->id,
        'user_id' => $owner->id,
    ]);
    $report = PlaceReport::create([
        'place_id' => $place->id,
        'reason' => 'spam',
        'user_id' => $reporter->id,
    ]);
    $adminToken = deletedPlacesBearer($superadmin, 'mobile:deleted-place-admin');

    $this->withToken(deletedPlacesBearer($owner, 'mobile:deleted-place-owner'))
        ->deleteJson('/api/mobile/account')
        ->assertOk();
    $this->withToken($adminToken)
        ->deleteJson("/api/mobile/admin/users/{$reporter->id}")
        ->assertOk();

    $this->getJson("/api/v1/places/{$place->id}")
        ->assertOk()
        ->assertJsonPath('user.id', $owner->id)
        ->assertJsonPath('user.name', 'مستخدم محذوف')
        ->assertJsonPath('user.avatar_url', null);
    $this->getJson("/api/v1/places/{$place->id}/comments")
        ->assertOk()
        ->assertJsonPath('data.0.id', $comment->id)
        ->assertJsonPath('data.0.user.id', $owner->id)
        ->assertJsonPath('data.0.user.name', 'مستخدم محذوف')
        ->assertJsonPath('data.0.user.avatar_url', null);
    $this->withToken($adminToken)->getJson('/api/v1/admin/places?status=all')
        ->assertOk()
        ->assertJsonPath('data.0.user.id', $owner->id)
        ->assertJsonPath('data.0.user.name', 'مستخدم محذوف')
        ->assertJsonPath('data.0.user.avatar_url', null);
    $this->withToken($adminToken)->getJson('/api/v1/admin/place-reports?status=all')
        ->assertOk()
        ->assertJsonPath('data.0.id', $report->id)
        ->assertJsonPath('data.0.user.id', $reporter->id)
        ->assertJsonPath('data.0.user.name', 'مستخدم محذوف');

    $deletedReporter = User::withTrashed()->findOrFail($reporter->id);
    expect($deletedReporter->avatar_url)->toBeNull()
        ->and($deletedReporter->email)->not->toBe('place-reporter@example.test')
        ->and($deletedReporter->email)->toEndWith('@deleted.invalid')
        ->and($deletedReporter->name)->not->toBe('Private Place Reporter');
});
