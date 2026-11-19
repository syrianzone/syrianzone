<?php

use App\Http\Controllers\PromisesAdminController;
use Illuminate\Support\Facades\Route;

return function (string $name): void {
    Route::post('/{promise}/reschedule', [PromisesAdminController::class, 'reschedule'])
        ->whereUuid('promise')
        ->middleware('promises_admin:promises.rule')
        ->name($name);
};
