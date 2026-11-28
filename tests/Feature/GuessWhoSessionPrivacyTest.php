<?php

use App\Events\GuessWhoStateEvent;
use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\GuessWhoGame;
use App\Support\GuessWho\RoomChannel;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

// A player's session id is their only credential: it authorises moves and
// reads their secret character. It used to be broadcast to the room (presence
// member id, turn, winner, remaining counts), so the opponent could read the
// other player's secret or play as them. The room now sees slots only.

beforeEach(function () {
    config(['broadcasting.default' => 'null']);
});

function privacyRoom(array $overrides = []): GuessWhoGame
{
    $category = GuessWhoCategory::create([
        'name_ar' => 'فئة', 'name_en' => 'Category', 'slug' => 'cat-'.Str::random(8), 'is_active' => true,
    ]);
    $ids = collect([1, 2, 3])->map(fn ($i) => GuessWhoCharacter::create([
        'category_id' => $category->id, 'name_ar' => 'شخصية '.$i, 'name_en' => 'C'.$i,
        'image_path' => 'img/'.$i.'.png', 'is_active' => true,
    ])->id)->all();

    return GuessWhoGame::create(array_merge([
        'room_code' => (string) Str::uuid(),
        'category_id' => $category->id,
        'character_ids' => $ids,
        'player_1_session' => 'secret-session-a',
        'player_2_session' => 'secret-session-b',
        'status' => 'selecting',
    ], $overrides));
}

test('presence members are identified by slot, not session id', function () {
    $room = privacyRoom();

    expect(RoomChannel::member(RoomChannel::role($room, 'secret-session-b'), null))
        ->toMatchArray(['id' => 'player_2', 'player' => 'player_2'])
        ->not->toHaveKey('session_id');
});

test('the custom broadcasting auth signs a slot, not the session id', function () {
    config([
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.key' => 'test-key',
    ]);

    $room = privacyRoom();

    $response = $this->withHeader('X-Guess-Who-Session-ID', 'secret-session-a')
        ->postJson('/guesswho/broadcasting/auth', [
            'socket_id' => '1.1',
            'channel_name' => "presence-guesswho.{$room->room_code}",
        ])
        ->assertOk();

    expect($response->json('channel_data'))->not->toContain('secret-session-a')
        ->and(json_decode($response->json('channel_data'), true)['user_id'])->toBe('player_1');
});

test('state broadcasts carry slots, never session ids', function () {
    Event::fake([GuessWhoStateEvent::class]);
    $room = privacyRoom();

    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'secret-session-a', 'action' => 'select_ready', 'payload' => ['id' => $room->character_ids[0]],
    ])->assertOk();
    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'secret-session-b', 'action' => 'select_ready', 'payload' => ['id' => $room->character_ids[1]],
    ])->assertOk();
    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'secret-session-a', 'action' => 'guess', 'payload' => ['character_id' => $room->character_ids[1]],
    ])->assertOk()->assertJsonPath('state.winner', 'player_1');

    Event::assertDispatched(GuessWhoStateEvent::class, function (GuessWhoStateEvent $e) {
        $payload = json_encode($e->broadcastWith());

        return ! str_contains($payload, 'secret-session-a') && ! str_contains($payload, 'secret-session-b');
    });
    Event::assertDispatched(GuessWhoStateEvent::class, fn (GuessWhoStateEvent $e) => $e->winner === 'player_1'
        && ($e->guess['by'] ?? null) === 'player_1');
});

test('a player cannot change their secret once play has started', function () {
    $room = privacyRoom(['status' => 'playing', 'turn_session' => 'secret-session-a']);
    $room->player_1_character_id = $room->character_ids[0];
    $room->player_2_character_id = $room->character_ids[1];
    $room->save();

    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'secret-session-b', 'action' => 'select_ready', 'payload' => ['id' => $room->character_ids[2]],
    ])->assertStatus(409);

    $fresh = $room->fresh();
    expect($fresh->player_2_character_id)->toBe($room->character_ids[1])
        ->and($fresh->turn_session)->toBe('secret-session-a');
});

test('a finished game cannot be reopened by selecting again', function () {
    $room = privacyRoom(['status' => 'finished', 'winner_session' => 'secret-session-a']);

    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'secret-session-b', 'action' => 'select_ready', 'payload' => ['id' => $room->character_ids[0]],
    ])->assertStatus(409);

    expect($room->fresh()->status)->toBe('finished');
});
