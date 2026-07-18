<?php

use App\Models\Place;
use App\Models\User;

function deletedPlacesBearer(User $user, string $name): string
{
    return $user->createToken($name, ['mobile'])->plainTextToken;
}

test('place responses keep anonymized authors after account deletion', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $owner = User::factory()->create([
        'avatar_url' => 'https://accounts.example.test/owner.png',
        'email' => 'place-owner@example.test',
        'name' => 'Private Place Owner',
        'role' => 'user',
    ]);
    $place = Place::factory()->approved()->create(['user_id' => $owner->id]);
    $adminToken = deletedPlacesBearer($superadmin, 'mobile:deleted-place-admin');

    $this->withToken(deletedPlacesBearer($owner, 'mobile:deleted-place-owner'))
        ->deleteJson('/api/mobile/account')
        ->assertOk();
    $deletedOwner = User::withTrashed()->findOrFail($owner->id);

    $this->withHeader('Authorization', '');
    $this->getJson("/api/v1/places/{$place->id}")
        ->assertOk()
        ->assertJsonPath('user.id', $owner->id)
        ->assertJsonPath('user.name', $deletedOwner->name)
        ->assertJsonPath('user.avatar_url', null);
    $this->withToken($adminToken)->getJson('/api/v1/admin/places?status=all')
        ->assertOk()
        ->assertJsonPath('data.0.user.id', $owner->id)
        ->assertJsonPath('data.0.user.name', $deletedOwner->name)
        ->assertJsonPath('data.0.user.avatar_url', null);

    expect($deletedOwner->avatar_url)->toBeNull()
        ->and($deletedOwner->email)->not->toBe('place-owner@example.test')
        ->and($deletedOwner->email)->toEndWith('@deleted.invalid')
        ->and($deletedOwner->name)->not->toBe('Private Place Owner');
});
