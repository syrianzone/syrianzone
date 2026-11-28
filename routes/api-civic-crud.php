<?php

use App\Http\Controllers\Api\CrossingApiController;
use App\Http\Controllers\Api\HouseApiController;
use App\Http\Controllers\Api\SyrianSiteApiController;
use Illuminate\Support\Facades\Route;

// Public read-only API for Crossings, Syrian Sites, and House Members 2026.
// Intended to be required at top-level from routes/api.php.
Route::prefix('v1')->middleware('throttle:public-api')->group(function () {
    Route::get('/crossings', [CrossingApiController::class, 'index'])
        ->name('api.v1.crossings.index');
    Route::get('/crossings/{slug}', [CrossingApiController::class, 'show'])
        ->where('slug', '[a-z0-9-]+')
        ->name('api.v1.crossings.show');

    Route::get('/sites', [SyrianSiteApiController::class, 'index'])
        ->name('api.v1.sites.index');
    Route::get('/sites/{slug}', [SyrianSiteApiController::class, 'show'])
        ->where('slug', '[a-z0-9-]+')
        ->name('api.v1.sites.show');

    Route::get('/house/members', [HouseApiController::class, 'index'])
        ->name('api.v1.house.members.index');
    Route::get('/house/members/{member_number}', [HouseApiController::class, 'show'])
        ->where('member_number', '[0-9A-Za-z-]+')
        ->name('api.v1.house.members.show');
});
