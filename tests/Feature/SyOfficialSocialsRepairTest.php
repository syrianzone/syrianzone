<?php

use App\Models\OfficialEntity;

/*
| Rows written before the platform keys were preserved hold a plain list of
| URLs. The command infers the platform from the host and rewrites only rows
| where every link maps to a slot the vocabulary has; anything ambiguous is
| reported and left for a human, and a second run changes nothing.
*/

it('rewrites a list-shaped socials row into a platform-keyed map', function () {
    $entity = OfficialEntity::factory()->create([
        'socials' => [
            'https://www.facebook.com/ministry',
            'https://x.com/ministry',
            'https://ministry.example/ar',
        ],
    ]);

    $this->artisan('syofficial:repair-socials')
        ->expectsOutputToContain("Repaired {$entity->id}: 3 link(s) -> facebook, twitter, website")
        ->expectsOutputToContain('1 row(s) repaired, 0 left alone.')
        ->assertSuccessful();

    expect($entity->fresh()->socials)->toBe([
        'facebook' => 'https://www.facebook.com/ministry',
        'twitter' => 'https://x.com/ministry',
        'website' => 'https://ministry.example/ar',
    ]);
});

it('uses the secondary slot when one platform appears twice', function () {
    $entity = OfficialEntity::factory()->create([
        'socials' => [
            'https://instagram.com/ministry',
            'https://instagram.com/ministry-news',
        ],
    ]);

    $this->artisan('syofficial:repair-socials')->assertSuccessful();

    expect($entity->fresh()->socials)->toBe([
        'instagram' => 'https://instagram.com/ministry',
        'instagram_secondary' => 'https://instagram.com/ministry-news',
    ]);
});

it('leaves an ambiguous row untouched and says so', function () {
    $socials = [
        'https://facebook.com/one',
        'https://facebook.com/two',
        'https://facebook.com/three',
    ];
    $entity = OfficialEntity::factory()->create(['socials' => $socials]);

    $this->artisan('syofficial:repair-socials')
        ->expectsOutputToContain("Left alone {$entity->id}")
        ->expectsOutputToContain('0 row(s) repaired, 1 left alone.')
        ->assertSuccessful();

    expect($entity->fresh()->socials)->toBe($socials);
});

it('never touches a row that is already a map, and is idempotent', function () {
    $map = ['facebook' => 'https://facebook.com/ministry', 'telegram' => 'https://t.me/ministry'];
    $entity = OfficialEntity::factory()->create(['socials' => $map]);
    $subject = OfficialEntity::factory()->create(['socials' => ['https://youtu.be/abc']]);

    $this->artisan('syofficial:repair-socials')
        ->expectsOutputToContain('1 row(s) repaired, 0 left alone.')
        ->assertSuccessful();

    expect($entity->fresh()->socials)->toBe($map)
        ->and($subject->fresh()->socials)->toBe(['youtube' => 'https://youtu.be/abc']);

    $this->artisan('syofficial:repair-socials')
        ->expectsOutputToContain('0 row(s) repaired, 0 left alone.')
        ->assertSuccessful();
});

it('reports without writing under --dry-run', function () {
    $entity = OfficialEntity::factory()->create(['socials' => ['https://t.me/ministry']]);

    $this->artisan('syofficial:repair-socials', ['--dry-run' => true])
        ->expectsOutputToContain("Would repair {$entity->id}")
        ->expectsOutputToContain('1 row(s) would be repaired, 0 left alone.')
        ->assertSuccessful();

    expect($entity->fresh()->socials)->toBe(['https://t.me/ministry']);
});

it('leaves an empty socials column alone', function () {
    $entity = OfficialEntity::factory()->create(['socials' => []]);

    $this->artisan('syofficial:repair-socials')
        ->expectsOutputToContain('0 row(s) repaired, 0 left alone.')
        ->assertSuccessful();

    expect($entity->fresh()->socials)->toBe([]);
});
