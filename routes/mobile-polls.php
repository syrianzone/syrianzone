<?php

use App\Http\Controllers\Mobile\AdminUploadController;
use App\Http\Controllers\Mobile\PollController;
use App\Http\Middleware\EnsureMobileBearerToken;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile')->name('mobile.polls.')->group(function () {
    Route::get('/polls', [PollController::class, 'index'])->name('index');
    Route::get('/polls/{idOrSlug}', [PollController::class, 'show'])->name('show');
    Route::get('/polls/{idOrSlug}/leaderboard', [PollController::class, 'leaderboard'])
        ->name('leaderboard');
    Route::post('/polls/{idOrSlug}/votes', [PollController::class, 'vote'])
        ->middleware('throttle:voting')
        ->name('vote');

    Route::middleware(['auth:sanctum', EnsureMobileBearerToken::class, 'admin'])
        ->prefix('admin')
        ->name('admin.')
        ->group(function () {
            Route::get('/polls', [PollController::class, 'adminIndex'])->name('index');
            Route::post('/polls', [PollController::class, 'adminStorePoll'])->name('store');
            Route::get('/polls/{id}', [PollController::class, 'adminShow'])->name('show');
            Route::put('/polls/{id}', [PollController::class, 'adminUpdatePoll'])->name('update');
            Route::delete('/polls/{id}', [PollController::class, 'adminDestroyPoll'])->name('destroy');

            Route::post('/candidate-groups', [PollController::class, 'adminStoreGroup']);
            Route::post('/candidate-groups/reorder', [PollController::class, 'adminReorderGroups']);
            Route::put('/candidate-groups/{id}', [PollController::class, 'adminUpdateGroup']);
            Route::delete('/candidate-groups/{id}', [PollController::class, 'adminDestroyGroup']);
            Route::post('/candidate-groups/{id}/default', [PollController::class, 'adminDefaultGroup']);

            Route::post('/candidates', [PollController::class, 'adminStoreCandidate']);
            Route::put('/candidates/{id}', [PollController::class, 'adminUpdateCandidate']);
            Route::delete('/candidates/{id}', [PollController::class, 'adminDestroyCandidate']);
            Route::patch('/candidates/{id}/archive', [PollController::class, 'adminArchiveCandidate']);
            Route::patch('/candidates/{id}/restore', [PollController::class, 'adminRestoreCandidate']);
            Route::post('/uploads', [AdminUploadController::class, 'store']);
        });
});
