<?php

use App\Models\GuessWhoGame;
use App\Models\User;
use App\Support\GuessWho\RoomChannel;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('guesswho.{roomCode}', function (?object $user, $roomCode) {
    $game = GuessWhoGame::where('room_code', $roomCode)->first();

    $sessionId = $game === null
        ? null
        : RoomChannel::verifiedSession($game, RoomChannel::sessionId(request()));

    if ($sessionId === null) {
        return false;
    }

    return RoomChannel::member($sessionId, $user instanceof User ? $user : null);
});
