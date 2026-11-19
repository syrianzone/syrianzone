<?php

use App\Http\Controllers\GuessWhoController;
use Illuminate\Support\Facades\Route;

return function (string $room, string $action, ?string $namePrefix): void {
    $name = fn (string $suffix): ?string => $namePrefix === null ? null : $namePrefix.$suffix;

    Route::post('/rooms', [GuessWhoController::class, 'createRoom'])
        ->middleware('throttle:10,1')
        ->name($name('rooms.store'));
    Route::post("/{$room}/{roomCode}/join", [GuessWhoController::class, 'joinRoom'])
        ->middleware('throttle:30,1')
        ->name($name('rooms.join'));
    // The game's own moves go over Reverb.
    Route::post("/{$room}/{roomCode}/{$action}", [GuessWhoController::class, 'action'])
        ->middleware('throttle:120,1')
        ->name($name('rooms.actions.store'));
    Route::get("/{$room}/{roomCode}/state", [GuessWhoController::class, 'state'])
        ->middleware('throttle:60,1')
        ->name($name('rooms.state'));
    Route::post('/broadcasting/auth', [GuessWhoController::class, 'authenticateBroadcasting'])
        ->middleware('throttle:30,1')
        ->name($name('broadcasting.auth'));
};
