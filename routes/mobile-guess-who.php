<?php

use App\Http\Controllers\Mobile\GuessWhoController;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile')->group(function () {
    Route::get('/realtime', [GuessWhoController::class, 'realtime']);

    Route::prefix('guess-who')->group(function () {
        Route::get('/categories', [GuessWhoController::class, 'categories'])->middleware('throttle:60,1');
        Route::post('/sessions', [GuessWhoController::class, 'issueSession'])->middleware('throttle:10,1');
        Route::post('/rooms', [GuessWhoController::class, 'createRoom'])->middleware('throttle:10,1');
        Route::get('/rooms/{roomCode}', [GuessWhoController::class, 'room'])->middleware('throttle:120,1');
        Route::post('/rooms/{roomCode}/join', [GuessWhoController::class, 'joinRoom'])->middleware('throttle:30,1');
        Route::post('/rooms/{roomCode}/signal', [GuessWhoController::class, 'signal'])->middleware('throttle:guess-who-signal');
        Route::post('/broadcasting/auth', [GuessWhoController::class, 'authenticateBroadcasting'])->middleware('throttle:120,1');
        Route::post('/turn-credentials', [GuessWhoController::class, 'turnCredentials'])->middleware('throttle:30,1');
    });
});
