<?php

use App\Events\GuessWhoSignalingEvent;
use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\MobileGuessWhoSession;
use Illuminate\Support\Facades\Event;

function seedMobileGuessWhoCategory(int $characters = 24): GuessWhoCategory
{
    static $sequence = 0;
    $sequence++;

    $category = GuessWhoCategory::create([
        'is_active' => true,
        'name_ar' => 'شخصيات سورية',
        'name_en' => 'Syrian figures',
        'slug' => "syrian-figures-{$sequence}",
    ]);
    foreach (range(1, $characters) as $index) {
        GuessWhoCharacter::create([
            'category_id' => $category->id,
            'image_path' => "guesswho/character-{$index}.jpg",
            'is_active' => true,
            'name_ar' => "الشخصية {$index}",
            'name_en' => "Character {$index}",
        ]);
    }

    return $category;
}

function issueMobileGuessWhoSession($test): array
{
    return $test->postJson('/api/mobile/guess-who/sessions')
        ->assertCreated()
        ->json('data');
}

function guessWhoCredential($test, string $credential)
{
    return $test->withHeader('X-Guess-Who-Session-ID', $credential);
}

test('mobile Guess Who categories include only playable active categories', function () {
    $playable = seedMobileGuessWhoCategory();
    seedMobileGuessWhoCategory(11);

    $this->getJson('/api/mobile/guess-who/categories')
        ->assertOk()
        ->assertJsonCount(1, 'data.categories')
        ->assertJsonPath('data.categories.0.id', $playable->id)
        ->assertJsonPath('data.categories.0.characters_count', 24)
        ->assertJsonPath('data.total_characters', 35);
});

test('mobile Guess Who issues expiring opaque credentials and stores only their hash', function () {
    $issued = issueMobileGuessWhoSession($this);
    $session = MobileGuessWhoSession::findOrFail($issued['session_id']);

    expect($issued['credential'])->toStartWith('gw_')
        ->and($issued['expires_at'])->toBeString()
        ->and($session->credential_hash)->toBe(hash('sha256', $issued['credential']))
        ->and($session->credential_hash)->not->toContain($issued['credential']);
});

test('mobile Guess Who atomically binds creator and joiner credentials to one room', function () {
    $category = seedMobileGuessWhoCategory();
    $creator = issueMobileGuessWhoSession($this);
    $joiner = issueMobileGuessWhoSession($this);

    $room = guessWhoCredential($this, $creator['credential'])
        ->postJson('/api/mobile/guess-who/rooms', ['category_id' => $category->id])
        ->assertCreated()
        ->assertJsonPath('data.role', 'player_1')
        ->json('data.room_code');

    guessWhoCredential($this, $joiner['credential'])
        ->postJson("/api/mobile/guess-who/rooms/{$room}/join")
        ->assertOk()
        ->assertJsonPath('data.role', 'player_2')
        ->assertJsonPath('data.room_code', $room);

    guessWhoCredential($this, $joiner['credential'])
        ->postJson("/api/mobile/guess-who/rooms/{$room}/join")
        ->assertOk()
        ->assertJsonPath('data.role', 'player_2');

    $third = issueMobileGuessWhoSession($this);
    guessWhoCredential($this, $third['credential'])
        ->postJson("/api/mobile/guess-who/rooms/{$room}/join")
        ->assertConflict()
        ->assertJsonPath('code', 'room_full');
});

test('mobile Guess Who room creation excludes inactive categories from explicit and random play', function () {
    $active = seedMobileGuessWhoCategory(12);
    $inactive = seedMobileGuessWhoCategory(24);
    $inactive->update(['is_active' => false]);

    $rejected = issueMobileGuessWhoSession($this);
    guessWhoCredential($this, $rejected['credential'])
        ->postJson('/api/mobile/guess-who/rooms', ['category_id' => $inactive->id])
        ->assertUnprocessable();

    $random = issueMobileGuessWhoSession($this);
    $room = guessWhoCredential($this, $random['credential'])
        ->postJson('/api/mobile/guess-who/rooms', ['category_id' => 'random'])
        ->assertCreated()
        ->json('data.room_code');
    $ids = guessWhoCredential($this, $random['credential'])
        ->getJson("/api/mobile/guess-who/rooms/{$room}")
        ->assertOk()
        ->json('data.category.characters.*.id');

    expect($ids)->toHaveCount(12)
        ->and(GuessWhoCharacter::whereIn('id', $ids)->pluck('category_id')->unique()->all())
        ->toBe([$active->id]);
});

test('mobile Guess Who room snapshots require the credential bound to that room', function () {
    $category = seedMobileGuessWhoCategory();
    $creator = issueMobileGuessWhoSession($this);
    $other = issueMobileGuessWhoSession($this);
    $room = guessWhoCredential($this, $creator['credential'])
        ->postJson('/api/mobile/guess-who/rooms', ['category_id' => $category->id])
        ->json('data.room_code');

    guessWhoCredential($this, $other['credential'])
        ->getJson("/api/mobile/guess-who/rooms/{$room}")
        ->assertForbidden()
        ->assertJsonPath('code', 'room_session_mismatch');

    guessWhoCredential($this, $creator['credential'])
        ->getJson("/api/mobile/guess-who/rooms/{$room}")
        ->assertOk()
        ->assertJsonCount(24, 'data.category.characters')
        ->assertJsonPath('data.role', 'player_1')
        ->assertJsonPath('data.status', 'lobby');
});

test('mobile Guess Who signaling derives the sender and rejects targets outside the room', function () {
    Event::fake([GuessWhoSignalingEvent::class]);
    $category = seedMobileGuessWhoCategory();
    $creator = issueMobileGuessWhoSession($this);
    $joiner = issueMobileGuessWhoSession($this);
    $outside = issueMobileGuessWhoSession($this);
    $room = guessWhoCredential($this, $creator['credential'])
        ->postJson('/api/mobile/guess-who/rooms', ['category_id' => $category->id])
        ->json('data.room_code');
    guessWhoCredential($this, $joiner['credential'])->postJson("/api/mobile/guess-who/rooms/{$room}/join");

    $payload = [
        'data' => ['sdp' => 'encoded'],
        'generation' => 3,
        'target_session' => $joiner['session_id'],
        'type' => 'offer',
    ];
    guessWhoCredential($this, $creator['credential'])
        ->postJson("/api/mobile/guess-who/rooms/{$room}/signal", $payload)
        ->assertOk()
        ->assertExactJson(['data' => ['status' => 'signal_sent']]);
    Event::assertDispatched(GuessWhoSignalingEvent::class, fn ($event) => $event->senderSession === $creator['session_id']
      && $event->targetSession === $joiner['session_id']
      && $event->generation === 3);

    guessWhoCredential($this, $creator['credential'])
        ->postJson("/api/mobile/guess-who/rooms/{$room}/signal", [
            ...$payload,
            'target_session' => $outside['session_id'],
        ])->assertUnprocessable();

    guessWhoCredential($this, $creator['credential'])
        ->postJson("/api/mobile/guess-who/rooms/{$room}/signal", [
            ...$payload,
            'data' => ['candidate' => str_repeat('x', 70_000)],
        ])->assertUnprocessable();
});

test('mobile Guess Who presence auth and TURN credentials require a room-bound session', function () {
    config([
        'broadcasting.connections.reverb.key' => 'reverb-key',
        'broadcasting.connections.reverb.secret' => 'reverb-secret',
        'guess-who.turn_secret' => 'turn-secret',
        'guess-who.turn_urls' => ['turn:turn.example.test:3478'],
    ]);
    $category = seedMobileGuessWhoCategory();
    $creator = issueMobileGuessWhoSession($this);
    $room = guessWhoCredential($this, $creator['credential'])
        ->postJson('/api/mobile/guess-who/rooms', ['category_id' => $category->id])
        ->json('data.room_code');

    $presence = guessWhoCredential($this, $creator['credential'])
        ->postJson('/api/mobile/guess-who/broadcasting/auth', [
            'channel_name' => "presence-guesswho.{$room}",
            'socket_id' => '123.456',
        ])->assertOk();
    expect($presence->json('auth'))->toStartWith('reverb-key:')
        ->and(json_decode($presence->json('channel_data'), true)['user_id'])->toBe($creator['session_id']);

    guessWhoCredential($this, $creator['credential'])
        ->postJson('/api/mobile/guess-who/turn-credentials', ['room_code' => $room])
        ->assertOk()
        ->assertJsonCount(2, 'data.ice_servers')
        ->assertJsonPath('data.ice_servers.1.urls', 'turn:turn.example.test:3478');
});

test('mobile realtime endpoint exposes only public Reverb connection settings', function () {
    config([
        'broadcasting.connections.reverb.client.host' => 'reverb.example.test',
        'broadcasting.connections.reverb.client.port' => 443,
        'broadcasting.connections.reverb.client.scheme' => 'https',
        'broadcasting.connections.reverb.key' => 'public-key',
        'broadcasting.connections.reverb.secret' => 'never-return-this',
    ]);

    $this->getJson('/api/mobile/realtime')
        ->assertOk()
        ->assertExactJson(['data' => [
            'force_tls' => true,
            'host' => 'reverb.example.test',
            'key' => 'public-key',
            'ws_port' => 80,
            'wss_port' => 443,
        ]])
        ->assertJsonMissing(['secret' => 'never-return-this']);
});
