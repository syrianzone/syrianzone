<?php

use App\Http\Controllers\MobileAuthController;
use App\Http\Middleware\EnsureMobileBearerToken;
use Illuminate\Support\Facades\Route;

Route::middleware('api')->prefix('api/mobile')->name('mobile.')->group(function () {
    Route::get('/auth/google', [MobileAuthController::class, 'redirectToGoogle'])
        ->middleware('throttle:mobile-auth-start')
        ->name('auth.google');
    Route::get('/auth/google/callback', [MobileAuthController::class, 'handleGoogleCallback'])
        ->middleware('throttle:mobile-auth-callback')
        ->name('auth.google.callback');
    Route::post('/auth/exchange', [MobileAuthController::class, 'exchange'])
        ->middleware('throttle:mobile-auth-exchange')
        ->name('auth.exchange');

    Route::middleware(['auth:sanctum', EnsureMobileBearerToken::class])->group(function () {
        Route::get('/user', [MobileAuthController::class, 'user'])->name('user');
        Route::post('/logout', [MobileAuthController::class, 'logout'])->name('logout');
    });
});
