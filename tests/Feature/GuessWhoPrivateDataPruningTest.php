<?php

use App\Models\GuessWhoCategory;
use App\Models\GuessWhoGame;
use App\Models\MobileGuessWhoSession;
use Carbon\Carbon;
use Illuminate\Support\Str;

test('expired Guess Who room state and credentials are pruned together', function () {
    Carbon::setTestNow('2026-07-16 12:00:00 UTC');
    $category = GuessWhoCategory::create([
        'is_active' => true,
        'name_ar' => 'اختبار',
        'name_en' => 'Test',
        'slug' => 'privacy-test',
    ]);

    $expiredRoom = (string) Str::uuid();
    $expiredSession = MobileGuessWhoSession::create([
        'credential_hash' => hash('sha256', 'expired-credential'),
        'expires_at' => now()->subMinute(),
        'role' => 'player_1',
        'room_code' => $expiredRoom,
    ]);
    GuessWhoGame::create([
        'category_id' => $category->id,
        'character_ids' => [],
        'player_1_session' => $expiredSession->id,
        'room_code' => $expiredRoom,
    ]);

    $currentRoom = (string) Str::uuid();
    $currentSession = MobileGuessWhoSession::create([
        'credential_hash' => hash('sha256', 'current-credential'),
        'expires_at' => now()->addHour(),
        'role' => 'player_1',
        'room_code' => $currentRoom,
    ]);
    GuessWhoGame::create([
        'category_id' => $category->id,
        'character_ids' => [],
        'player_1_session' => $currentSession->id,
        'room_code' => $currentRoom,
    ]);

    $this->artisan('guess-who:prune-expired-sessions')
        ->expectsOutputToContain('Pruned 1 expired room and 1 session.')
        ->assertSuccessful();

    $this->assertDatabaseMissing('mobile_guess_who_sessions', ['id' => $expiredSession->id]);
    $this->assertDatabaseMissing('guess_who_games', ['room_code' => $expiredRoom]);
    $this->assertDatabaseHas('mobile_guess_who_sessions', ['id' => $currentSession->id]);
    $this->assertDatabaseHas('guess_who_games', ['room_code' => $currentRoom]);
});
