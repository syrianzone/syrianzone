<?php

use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\GuessWhoGame;
use Illuminate\Support\Str;

// The action endpoint is the WebRTC data channel's replacement, and now the
// server owns the rules: whose turn it is and each player's secret. These cover
// the HTTP contract and the validation (the null broadcaster no-ops in tests).

beforeEach(function () {
    config(['broadcasting.default' => 'null']);
});

/** A room with a real category and three characters, so the id FKs hold. */
function guessWhoRoom(array $overrides = []): GuessWhoGame
{
    $category = GuessWhoCategory::create([
        'name_ar' => 'فئة',
        'name_en' => 'Category',
        'slug' => 'cat-'.Str::random(8),
        'is_active' => true,
    ]);

    $ids = collect([1, 2, 3])->map(fn ($i) => GuessWhoCharacter::create([
        'category_id' => $category->id,
        'name_ar' => 'شخصية '.$i,
        'name_en' => 'Character '.$i,
        'image_path' => 'img/'.$i.'.png',
        'is_active' => true,
    ])->id)->all();

    return GuessWhoGame::create(array_merge([
        'room_code' => (string) Str::uuid(),
        'category_id' => $category->id,
        'character_ids' => $ids,
        'player_1_session' => 'qa-A',
        'player_2_session' => 'qa-B',
        'status' => 'selecting',
    ], $overrides));
}

function act(GuessWhoGame $room, string $session, string $action, array $payload = [])
{
    return test()->postJson("/guesswho/room/{$room->room_code}/action", [
        'sender_session' => $session,
        'action' => $action,
        'payload' => $payload,
    ]);
}

test('a member relays a cosmetic action', function () {
    $room = guessWhoRoom();

    act($room, 'qa-A', 'elimination_update', ['remaining' => 9])
        ->assertOk()
        ->assertJson(['status' => 'action_sent']);
});

test('an outsider, an unknown room, an oversized payload and a bad action name are refused', function () {
    $room = guessWhoRoom();

    act($room, 'qa-X', 'pass_turn')->assertForbidden();
    $this->postJson('/guesswho/room/'.Str::uuid().'/action', [
        'sender_session' => 'qa-A',
        'action' => 'pass_turn',
    ])->assertNotFound();
    act($room, 'qa-A', 'elimination_update', ['blob' => str_repeat('x', 20000)])->assertStatus(413);
    act($room, 'qa-A', str_repeat('x', 60))->assertStatus(422);
});

test('choosing a secret must be a character in the room', function () {
    $room = guessWhoRoom();

    act($room, 'qa-A', 'select_ready', ['id' => 99999])->assertStatus(422);
    act($room, 'qa-A', 'select_ready', ['id' => $room->character_ids[0]])->assertOk();

    expect($room->fresh()->player_1_character_id)->toBe($room->character_ids[0]);
});

test('the game starts, and player 1 leads, once both secrets are in', function () {
    $room = guessWhoRoom();

    act($room, 'qa-A', 'select_ready', ['id' => $room->character_ids[0]])->assertOk();
    expect($room->fresh()->status)->toBe('selecting');
    expect($room->fresh()->turn_session)->toBeNull();

    act($room, 'qa-B', 'select_ready', ['id' => $room->character_ids[1]])->assertOk();
    $fresh = $room->fresh();
    expect($fresh->status)->toBe('playing');
    expect($fresh->player_2_character_id)->toBe($room->character_ids[1]);
    expect($fresh->turn_session)->toBe('qa-A');
});

test('only the player on turn may pass, and it hands the turn over', function () {
    $room = guessWhoRoom(['status' => 'playing', 'turn_session' => 'qa-A']);

    act($room, 'qa-B', 'pass_turn')->assertStatus(409);
    act($room, 'qa-A', 'pass_turn')->assertOk();
    expect($room->fresh()->turn_session)->toBe('qa-B');
});

test('a correct guess ends the game with the guesser as winner', function () {
    $room = guessWhoRoom([
        'status' => 'playing',
        'turn_session' => 'qa-A',
        'player_1_character_id' => null,
        'player_2_character_id' => null,
    ]);

    $room->player_1_character_id = $room->character_ids[0];
    $room->player_2_character_id = $room->character_ids[1];
    $room->save();

    act($room, 'qa-A', 'guess', ['character_id' => $room->character_ids[1]])->assertOk();
    $fresh = $room->fresh();
    expect($fresh->status)->toBe('finished');
    expect($fresh->winner_session)->toBe('qa-A');
    expect($fresh->turn_session)->toBeNull();
});

test('a wrong guess passes the turn', function () {
    $room = guessWhoRoom(['status' => 'playing', 'turn_session' => 'qa-A']);
    $room->player_1_character_id = $room->character_ids[0];
    $room->player_2_character_id = $room->character_ids[1];
    $room->save();

    act($room, 'qa-A', 'guess', ['character_id' => $room->character_ids[2]])->assertOk();
    $fresh = $room->fresh();
    expect($fresh->status)->toBe('playing');
    expect($fresh->winner_session)->toBeNull();
    expect($fresh->turn_session)->toBe('qa-B');
});

test('a guess out of turn is refused', function () {
    $room = guessWhoRoom(['status' => 'playing', 'turn_session' => 'qa-A']);
    $room->player_1_character_id = $room->character_ids[0];
    $room->player_2_character_id = $room->character_ids[1];
    $room->save();

    act($room, 'qa-B', 'guess', ['character_id' => $room->character_ids[0]])->assertStatus(409);
    expect($room->fresh()->status)->toBe('playing');
});
