<?php

use App\Http\Controllers\Mobile\PlaceAdminController;
use App\Http\Controllers\Mobile\PlaceController;
use App\Http\Controllers\Mobile\PlaceEngagementController;
use App\Http\Middleware\EnsureMobileBearerToken;
use App\Http\Middleware\ResolveOptionalMobileBearerToken;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::middleware([ResolveOptionalMobileBearerToken::class, 'throttle:60,1'])->group(function () {
        Route::get('/places/map', [PlaceController::class, 'mapData']);
        Route::get('/places/nearby', [PlaceController::class, 'nearby']);
        Route::get('/places', [PlaceController::class, 'index']);
        Route::get('/places/{id}', [PlaceController::class, 'show'])->whereNumber('id');
        Route::get('/places/{id}/comments', [PlaceEngagementController::class, 'comments'])->whereNumber('id');
    });

    Route::middleware(['auth:sanctum', EnsureMobileBearerToken::class])->group(function () {
        Route::post('/places', [PlaceController::class, 'store'])->middleware('throttle:5,60');
        Route::get('/my/places', [PlaceController::class, 'mine'])->middleware('throttle:60,1');
        Route::get('/my/saves', [PlaceEngagementController::class, 'mySaves'])->middleware('throttle:60,1');
        Route::post('/places/{id}/like', [PlaceEngagementController::class, 'like'])
            ->whereNumber('id')
            ->middleware('throttle:60,1');
        Route::delete('/places/{id}/like', [PlaceEngagementController::class, 'unlike'])
            ->whereNumber('id')
            ->middleware('throttle:60,1');
        Route::post('/places/{id}/save', [PlaceEngagementController::class, 'save'])
            ->whereNumber('id')
            ->middleware('throttle:60,1');
        Route::delete('/places/{id}/save', [PlaceEngagementController::class, 'unsave'])
            ->whereNumber('id')
            ->middleware('throttle:60,1');
        Route::post('/places/{id}/comments', [PlaceEngagementController::class, 'storeComment'])
            ->whereNumber('id')
            ->middleware('throttle:10,1');
        Route::delete('/place-comments/{id}', [PlaceEngagementController::class, 'destroyComment'])
            ->whereNumber('id')
            ->middleware('throttle:60,1');
        Route::post('/places/{id}/report', [PlaceEngagementController::class, 'report'])
            ->whereNumber('id')
            ->middleware('throttle:5,60');

        Route::middleware(['admin', 'throttle:60,1'])->prefix('admin')->group(function () {
            Route::get('/places', [PlaceAdminController::class, 'index']);
            Route::post('/places/{id}/approve', [PlaceAdminController::class, 'approve'])->whereNumber('id');
            Route::post('/places/{id}/reject', [PlaceAdminController::class, 'reject'])->whereNumber('id');
            Route::delete('/places/{id}', [PlaceAdminController::class, 'destroy'])->whereNumber('id');
            Route::get('/place-reports', [PlaceAdminController::class, 'reports']);
            Route::post('/place-reports/{id}/resolve', [PlaceAdminController::class, 'resolveReport'])->whereNumber('id');
        });
    });
});
