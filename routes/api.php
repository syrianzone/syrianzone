<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\PollController;
use App\Http\Controllers\ContributorController;
use App\Http\Controllers\MetricsController;
use App\Http\Controllers\Api\PopulationAtlasController;

Route::get('/polls', [PollController::class, 'index']);
Route::get('/polls/{idOrSlug}', [PollController::class, 'show']);
Route::get('/polls/{idOrSlug}/leaderboard', [PollController::class, 'leaderboard']);

Route::middleware('throttle:voting')->group(function () {
    Route::post('/submit', [PollController::class, 'submit']);
});



Route::get('/contributors', [ContributorController::class, 'index']);
Route::get('/contributors/{contributor}', [ContributorController::class, 'show']);

Route::get('/population/master', [PopulationAtlasController::class, 'getData']);
Route::get('/population/env-report', [PopulationAtlasController::class, 'getEnvironmentalDetails']);



Route::get('/metrics', [MetricsController::class, 'index']);

Route::prefix('v1')->group(function () {
    Route::get('/cities', [\App\Http\Controllers\Api\V1\TransitController::class, 'getCities']);
    Route::get('/cities/{id}/routes', [\App\Http\Controllers\Api\V1\TransitController::class, 'getRoutes']);
    Route::get('/cities/{id}/map-data', [\App\Http\Controllers\Api\V1\TransitController::class, 'getMapData']);
    Route::get('/stops/nearby', [\App\Http\Controllers\Api\V1\TransitController::class, 'getNearbyStops']);
    Route::get('/search', [\App\Http\Controllers\Api\V1\TransitController::class, 'search']);

    // Transit Studio — open for community contributions
    Route::post('/studio/routes', [\App\Http\Controllers\TransitStudioController::class, 'store'])
        ->middleware('throttle:5,1');


});
