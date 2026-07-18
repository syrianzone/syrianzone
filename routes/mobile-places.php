<?php

use App\Http\Controllers\PlaceAdminController;
use App\Http\Controllers\PlaceController;
use App\Http\Controllers\PlaceDiscoveryController;
use App\Http\Controllers\PlaceEngagementController;
use App\Http\Middleware\ResolveOptionalMobileBearerToken;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::middleware([ResolveOptionalMobileBearerToken::class, 'throttle:60,1'])->group(function () {
        Route::get('/places/map', [PlaceController::class, 'mapData']);
        Route::get('/places/geocode', [PlaceController::class, 'geocode']);
        Route::get('/guides', [PlaceDiscoveryController::class, 'guides']);
        Route::get('/places/photos', [PlaceDiscoveryController::class, 'photos']);
        Route::get('/places/nearby', [PlaceController::class, 'nearby']);
        Route::get('/places', [PlaceController::class, 'index']);
        Route::get('/places/{id}', [PlaceController::class, 'show'])->whereNumber('id');
    });

    Route::middleware([ResolveOptionalMobileBearerToken::class, 'auth:sanctum'])->group(function () {
        Route::post('/places', [PlaceController::class, 'store'])->middleware('throttle:20,60');
        Route::get('/my/places', [PlaceController::class, 'mine'])->middleware('throttle:60,1');
        Route::patch('/my/places/{id}/location', [PlaceController::class, 'updateLocation'])
            ->whereNumber('id')
            ->middleware('throttle:20,60');
        Route::patch('/my/places/{id}', [PlaceController::class, 'updateDetails'])
            ->whereNumber('id')
            ->middleware('throttle:20,60');
        Route::post('/my/places/{id}/photos', [PlaceController::class, 'addPhoto'])
            ->whereNumber('id')
            ->middleware('throttle:20,60');
        Route::post('/my/places/{id}/resubmit', [PlaceController::class, 'resubmit'])
            ->whereNumber('id')
            ->middleware('throttle:20,60');
        Route::delete('/my/places/{id}', [PlaceController::class, 'destroy'])
            ->whereNumber('id')
            ->middleware('throttle:20,60');
        Route::delete('/my/place-photos/{id}', [PlaceController::class, 'deletePhoto'])
            ->whereNumber('id')
            ->middleware('throttle:20,60');
        Route::post('/my/place-photos/{id}/rotate', [PlaceController::class, 'rotatePhoto'])
            ->whereNumber('id')
            ->middleware('throttle:20,60');
        Route::get('/my/saves', [PlaceEngagementController::class, 'mySaves'])->middleware('throttle:60,1');
        Route::post('/places/{id}/save', [PlaceEngagementController::class, 'save'])
            ->whereNumber('id')
            ->middleware('throttle:60,1');
        Route::delete('/places/{id}/save', [PlaceEngagementController::class, 'unsave'])
            ->whereNumber('id')
            ->middleware('throttle:60,1');

        Route::middleware(['admin', 'throttle:60,1'])->prefix('admin')->group(function () {
            Route::get('/places', [PlaceAdminController::class, 'index']);
            Route::post('/places/{id}/approve', [PlaceAdminController::class, 'approve'])->whereNumber('id');
            Route::post('/places/{id}/reject', [PlaceAdminController::class, 'reject'])->whereNumber('id');
            Route::patch('/places/{id}', [PlaceAdminController::class, 'update'])->whereNumber('id');
            Route::delete('/places/{id}', [PlaceAdminController::class, 'destroy'])->whereNumber('id');
            Route::post('/places/{id}/photos', [PlaceAdminController::class, 'addPhoto'])->whereNumber('id');
            Route::post('/place-photos/{id}/rotate', [PlaceAdminController::class, 'rotatePhoto'])->whereNumber('id');
            Route::post('/place-photos/{id}/replace', [PlaceAdminController::class, 'replacePhoto'])->whereNumber('id');
            Route::delete('/place-photos/{id}', [PlaceAdminController::class, 'deletePhoto'])->whereNumber('id');
        });
    });
});
