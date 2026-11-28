<?php

use App\Http\Controllers\Api\CompassPublicApiController;
use App\Http\Controllers\Api\GovAppsApiController;
use App\Http\Controllers\Api\GovernoratesApiController;
use App\Http\Controllers\Api\MinistriesApiController;
use App\Http\Controllers\Api\PhonebookApiController;
use App\Http\Controllers\Api\PromisesPublicApiController;
use App\Http\Controllers\Api\SyOfficialApiController;
use App\Http\Controllers\Api\WildlifeApiController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Civic Read-Only API Routes (mounted inside `/api/v1/` in routes/api.php)
|--------------------------------------------------------------------------
|
| Strictly read-only public civic datasets with ETag + Cache-Control support
| and `throttle:public-api` rate limiting. Zero PII.
|
*/

Route::middleware('throttle:public-api')->group(function () {
    Route::get('/phonebook', [PhonebookApiController::class, 'index'])
        ->name('api.v1.phonebook.index');

    Route::get('/syofficial', [SyOfficialApiController::class, 'index'])
        ->name('api.v1.syofficial.index');

    Route::get('/govapps', [GovAppsApiController::class, 'index'])
        ->name('api.v1.govapps.index');
    Route::get('/govapps/{id}', [GovAppsApiController::class, 'show'])
        ->where('id', '[A-Za-z0-9_-]+')
        ->name('api.v1.govapps.show');

    Route::get('/wildlife', [WildlifeApiController::class, 'index'])
        ->name('api.v1.wildlife.index');
    Route::get('/wildlife/{slug}', [WildlifeApiController::class, 'show'])
        ->where('slug', '[a-z0-9-]+')
        ->name('api.v1.wildlife.show');

    // Public read-only listing/options/detail alongside existing /promises/speakers
    Route::get('/promises', [PromisesPublicApiController::class, 'index'])
        ->name('api.v1.promises.index');
    Route::get('/promises/options', [PromisesPublicApiController::class, 'options'])
        ->name('api.v1.promises.options');
    Route::get('/promises/{number}', [PromisesPublicApiController::class, 'show'])
        ->where('number', '[0-9]{1,9}')
        ->name('api.v1.promises.show');

    Route::get('/ministries', [MinistriesApiController::class, 'index'])
        ->name('api.v1.ministries.index');
    Route::get('/ministries/{slug}', [MinistriesApiController::class, 'show'])
        ->where('slug', '[a-z0-9-]+')
        ->name('api.v1.ministries.show');

    Route::get('/governorates', [GovernoratesApiController::class, 'index'])
        ->name('api.v1.governorates.index');
    Route::get('/governorates/{id}', [GovernoratesApiController::class, 'show'])
        ->where('id', '[a-z0-9-]+')
        ->name('api.v1.governorates.show');

    Route::get('/compass/stats', [CompassPublicApiController::class, 'stats'])
        ->name('api.v1.compass.stats.index');
    Route::get('/compass/config', [CompassPublicApiController::class, 'config'])
        ->name('api.v1.compass.config');
});
