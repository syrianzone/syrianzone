<?php

use App\Http\Controllers\Api\BootstrapController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/bootstrap', [BootstrapController::class, 'show'])
        ->middleware('throttle:60,1')
        ->name('api.v1.bootstrap.show');
});
