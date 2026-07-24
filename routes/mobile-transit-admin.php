<?php

use App\Http\Controllers\TransitAdminController;
use App\Http\Middleware\EnsureMobileBearerToken;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile/admin')
    ->name('mobile.admin.transit.')
    ->middleware([EnsureMobileBearerToken::class, 'transit_admin', 'throttle:60,1'])
    ->group(function () {
        Route::get('/transit-drafts', [TransitAdminController::class, 'index'])
            ->middleware('transit_admin:transit.review_drafts')
            ->name('index');
        Route::post('/transit-drafts/{id}/approve', [TransitAdminController::class, 'approve'])
            ->middleware('transit_admin:transit.approve')
            ->whereNumber('id')
            ->name('approve');
        Route::post('/transit-drafts/{id}/reject', [TransitAdminController::class, 'reject'])
            ->middleware('transit_admin:transit.reject')
            ->whereNumber('id')
            ->name('reject');

        Route::get('/routes', [TransitAdminController::class, 'getPublishedRoutes'])
            ->middleware('transit_admin:transit.edit_routes')
            ->name('routes.index');
        Route::get('/routes/logs', [TransitAdminController::class, 'getLogs'])
            ->middleware('transit_admin:transit.view_logs')
            ->name('routes.logs');
        Route::post('/routes/combine', [TransitAdminController::class, 'combineRoutes'])
            ->middleware('transit_admin:transit.combine_routes')
            ->name('routes.combine');
        Route::post('/routes/split', [TransitAdminController::class, 'splitRoute'])
            ->middleware('transit_admin:transit.split_routes')
            ->name('routes.split');
        Route::post('/routes/{id}/status', [TransitAdminController::class, 'updateRouteStatus'])
            ->middleware('transit_admin:transit.edit_routes')
            ->name('routes.status');
        Route::put('/routes/{id}', [TransitAdminController::class, 'updateRoute'])
            ->middleware('transit_admin:transit.edit_routes')
            ->name('routes.update');
        Route::post('/routes/{id}/move', [TransitAdminController::class, 'moveRoute'])
            ->middleware('transit_admin:transit.move_routes')
            ->name('routes.move');
        Route::get('/routes/{id}/stops', [TransitAdminController::class, 'getRouteStops'])
            ->middleware('transit_admin:transit.edit_routes')
            ->name('routes.stops');
        Route::get('/routes/{id}/geojson', [TransitAdminController::class, 'getRouteGeoJson'])
            ->middleware('transit_admin:transit.edit_routes')
            ->name('routes.geojson');
    });
