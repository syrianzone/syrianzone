<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\PollController;
use App\Http\Controllers\ContributorController;
use App\Http\Controllers\SiteController;
use App\Http\Controllers\MetricsController;
use App\Http\Controllers\Api\PopulationAtlasController;

Route::get('/polls', [PollController::class, 'index']);
Route::get('/polls/{poll}', [PollController::class, 'show']);
Route::get('/polls/{poll}/leaderboard', [PollController::class, 'leaderboard']);

Route::middleware('throttle:voting')->group(function () {
    Route::post('/polls/{poll}/vote', [PollController::class, 'vote']);
    Route::post('/submit', [PollController::class, 'submit']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::post('/polls', [PollController::class, 'store']);
    Route::put('/polls/{id}', [PollController::class, 'update']);
    Route::delete('/polls/{id}', [PollController::class, 'destroy']);

    Route::apiResource('candidate-groups', \App\Http\Controllers\CandidateGroupController::class);
    Route::post('/candidate-groups/reorder', [\App\Http\Controllers\CandidateGroupController::class, 'reorder']);
    Route::post('/candidate-groups/{id}/default', [\App\Http\Controllers\CandidateGroupController::class, 'setDefault']);

    Route::apiResource('candidates', \App\Http\Controllers\CandidateController::class)->except(['index', 'show']);
    Route::patch('/candidates/{id}/archive', [\App\Http\Controllers\CandidateController::class, 'archive']);
    Route::patch('/candidates/{id}/restore', [\App\Http\Controllers\CandidateController::class, 'restore']);
});

Route::get('/contributors', [ContributorController::class, 'index']);
Route::get('/contributors/{contributor}', [ContributorController::class, 'show']);

Route::get('/sites', [SiteController::class, 'index']);

Route::get('/population/master', [PopulationAtlasController::class, 'getData']);
Route::get('/population/env-report', [PopulationAtlasController::class, 'getEnvironmentalDetails']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/sites', [SiteController::class, 'store']);
    Route::put('/sites/{id}', [SiteController::class, 'update']);
    Route::delete('/sites/{id}', [SiteController::class, 'destroy']);
});

Route::get('/metrics', [MetricsController::class, 'index']);

Route::prefix('v1')->group(function () {
    Route::get('/cities', [\App\Http\Controllers\Api\V1\TransitController::class, 'getCities']);
    Route::get('/cities/{id}/routes', [\App\Http\Controllers\Api\V1\TransitController::class, 'getRoutes']);
    Route::get('/cities/{id}/map-data', [\App\Http\Controllers\Api\V1\TransitController::class, 'getMapData']);
    Route::get('/stops/nearby', [\App\Http\Controllers\Api\V1\TransitController::class, 'getNearbyStops']);
    Route::get('/search', [\App\Http\Controllers\Api\V1\TransitController::class, 'search']);

    // Transit Studio — open for community contributions
    Route::post('/studio/routes', [\App\Http\Controllers\TransitStudioController::class, 'store']);

    // Transit Admin auth
    Route::post('/admin/login', [\App\Http\Controllers\TransitAuthController::class, 'login']);

    // Transit Admin — requires transit admin token
    Route::middleware('transit.admin')->group(function () {
        Route::get('/admin/route-drafts', [\App\Http\Controllers\TransitAdminController::class, 'index']);
        Route::post('/admin/route-drafts/{id}/approve', [\App\Http\Controllers\TransitAdminController::class, 'approve']);
        Route::post('/admin/route-drafts/{id}/reject', [\App\Http\Controllers\TransitAdminController::class, 'reject']);
    });
});
