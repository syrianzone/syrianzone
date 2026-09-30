<?php

use App\Models\GuessWhoGame;
use Illuminate\Support\Str;

// The action relay is the WebRTC data channel's replacement: a member POSTs a
// move and the server rebroadcasts it on the room's presence channel. These
// cover the HTTP contract, not the broadcast itself (the null broadcaster
// no-ops in tests).

beforeEach(function () {
    config(['broadcasting.default' => 'null']);
});

function guessWhoRoom(string $player1 = 'qa-A', ?string $player2 = 'qa-B'): GuessWhoGame
{
    return GuessWhoGame::create([
        'room_code' => (string) Str::uuid(),
        'category_id' => null,
        'character_ids' => [],
        'player_1_session' => $player1,
        'player_2_session' => $player2,
        'status' => 'playing',
    ]);
}

test('a room member can relay an action', function () {
    $room = guessWhoRoom();

    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'qa-A',
        'action' => 'select_ready',
        'payload' => ['id' => 7],
    ])->assertOk()->assertJson(['status' => 'action_sent']);
});

test('the second player may relay too, but an outsider may not', function () {
    $room = guessWhoRoom();

    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'qa-B',
        'action' => 'pass_turn',
    ])->assertOk();

    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'qa-X',
        'action' => 'guess',
        'payload' => ['character_id' => 1],
    ])->assertForbidden();
});

test('an unknown room is a 404', function () {
    $this->postJson('/guesswho/room/'.Str::uuid().'/action', [
        'sender_session' => 'qa-A',
        'action' => 'pass_turn',
    ])->assertNotFound();
});

test('an oversized payload is rejected', function () {
    $room = guessWhoRoom();

    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'qa-A',
        'action' => 'select_ready',
        'payload' => ['blob' => str_repeat('x', 20000)],
    ])->assertStatus(413);
});

test('a malformed action name fails validation', function () {
    $room = guessWhoRoom();

    $this->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => 'qa-A',
        'action' => str_repeat('x', 60),
    ])->assertStatus(422);
});
