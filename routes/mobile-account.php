<?php

use App\Http\Controllers\Mobile\AccountController;
use App\Http\Controllers\Mobile\AdminUserController;
use App\Http\Middleware\EnsureMobileBearerToken;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile')
    ->middleware(['auth:sanctum', EnsureMobileBearerToken::class])
    ->group(function () {
        Route::get('/account', [AccountController::class, 'show']);
        Route::patch('/account', [AccountController::class, 'update']);
        Route::post('/account/avatar', [AccountController::class, 'updateAvatar'])
            ->middleware('throttle:10,1');
        Route::delete('/account', [AccountController::class, 'destroy']);
        Route::delete('/account/transit-drafts/{id}', [AccountController::class, 'destroyDraft'])
            ->whereNumber('id');

        Route::prefix('admin')->group(function () {
            Route::middleware('superadmin')->group(function () {
                Route::get('/users', [AdminUserController::class, 'index']);
                Route::post('/users', [AdminUserController::class, 'store']);
                Route::delete('/users/{user}', [AdminUserController::class, 'destroy']);
            });

            Route::post('/users/{user}/toggle-ban', [AdminUserController::class, 'toggleBan'])
                ->middleware('transit_admin');
        });
    });
