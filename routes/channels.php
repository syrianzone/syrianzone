<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('guesswho.{roomCode}', function (?object $user, $roomCode) {
    // Read local storage guest session ID from request headers
    $sessionId = request()->header('X-Guess-Who-Session-ID')
        ?? request()->input('session_id') 
        ?? request()->session()->get('guess_who_session_id') 
        ?? 'guest-' . \Illuminate\Support\Str::uuid();
        
    return [
        'id' => $sessionId,
        'session_id' => $sessionId,
        'name' => $user ? $user->name : 'لاعب ضيف',
    ];
});

