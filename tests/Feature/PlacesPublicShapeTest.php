<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\User;

/*
| The public mishwar endpoints serve fixed key sets, and the presenters that
| build them are shared with the admin and agent surfaces. A moderation change
| must not reshape what the map, the web app and the mobile client read.
*/

function publicShapeUser(): User
{
    return User::factory()->create(['role' => 'user']);
}

test('list rows expose exactly the public list keys', function () {
    Place::factory()->approved()->create();

    $response = $this->getJson('/api/v1/places')->assertOk();

    expect(array_keys($response->json('data.0')))->toBe([
        'id', 'name', 'category', 'description', 'lat', 'lng', 'thumb_url', 'saves_count',
    ]);
});

test('detail exposes exactly the public detail keys', function () {
    $owner = publicShapeUser();
    $place = Place::factory()->approved()->create(['user_id' => $owner->id]);
    PlacePhoto::factory()->create(['place_id' => $place->id]);

    $response = $this->getJson("/api/v1/places/{$place->id}")->assertOk();

    expect(array_keys($response->json()))->toBe([
        'id', 'name', 'category', 'description', 'lat', 'lng', 'thumb_url', 'saves_count',
        'status', 'user', 'photos', 'saved_by_me', 'created_at',
    ]);
    expect(array_keys($response->json('user')))->toBe(['id', 'name', 'avatar_url', 'level', 'points']);
    expect(array_keys($response->json('photos.0')))->toBe(['id', 'thumb_url', 'display_url', 'sort']);
});

test('owner rows expose exactly the my-places keys', function () {
    $owner = publicShapeUser();
    Place::factory()->approved()->create(['user_id' => $owner->id]);

    $response = $this->actingAs($owner)->getJson('/api/v1/my/places')->assertOk();

    expect(array_keys($response->json('data.0')))->toBe([
        'id', 'name', 'category', 'description', 'lat', 'lng', 'thumb_url', 'saves_count',
        'status', 'rejection_reason', 'created_at',
    ]);
});

test('nearby rows are the public list row plus the distance', function () {
    Place::factory()->approved()->create(['lat' => 33.5, 'lng' => 36.3]);

    $response = $this->getJson('/api/v1/places/nearby?lat=33.5&lng=36.3')->assertOk();

    expect(array_keys($response->json('places.0')))->toBe([
        'id', 'name', 'category', 'description', 'lat', 'lng', 'thumb_url', 'saves_count',
        'distance_m',
    ]);
});
