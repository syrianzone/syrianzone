<?php

use App\Http\Controllers\TransitAdminController;
use App\Http\Middleware\EnsureMobileBearerToken;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile/admin')
    ->name('mobile.admin.transit.')
    ->middleware([EnsureMobileBearerToken::class, 'transit_admin', 'throttle:60,1'])
    ->group(function () {
        Route::get('/transit-drafts', [TransitAdminController::class, 'index'])->name('index');
        Route::post('/transit-drafts/{id}/approve', [TransitAdminController::class, 'approve'])
            ->whereNumber('id')
            ->name('approve');
        Route::post('/transit-drafts/{id}/reject', [TransitAdminController::class, 'reject'])
            ->whereNumber('id')
            ->name('reject');

        Route::get('/routes', [TransitAdminController::class, 'getPublishedRoutes'])->name('routes.index');
        Route::get('/routes/logs', [TransitAdminController::class, 'getLogs'])->name('routes.logs');
        Route::post('/routes/combine', [TransitAdminController::class, 'combineRoutes'])->name('routes.combine');
        Route::post('/routes/split', [TransitAdminController::class, 'splitRoute'])->name('routes.split');
        Route::post('/routes/{id}/status', [TransitAdminController::class, 'updateRouteStatus'])->name('routes.status');
        Route::put('/routes/{id}', [TransitAdminController::class, 'updateRoute'])->name('routes.update');
        Route::post('/routes/{id}/move', [TransitAdminController::class, 'moveRoute'])->name('routes.move');
        Route::get('/routes/{id}/stops', [TransitAdminController::class, 'getRouteStops'])->name('routes.stops');
        Route::get('/routes/{id}/geojson', [TransitAdminController::class, 'getRouteGeoJson'])->name('routes.geojson');
    });
