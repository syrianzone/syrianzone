<?php

use App\Http\Controllers\Admin\CrossingAdminController;
use App\Http\Controllers\Admin\HouseAdminController;
use App\Http\Controllers\Admin\SyrianSiteAdminController;
use App\Http\Middleware\FirstPartyAdminTransport;
use Illuminate\Support\Facades\Route;

// Admin CRUD API for Crossings, Syrian Sites, and House Members 2026.
// Intended to be required at top-level from routes/admin-api.php.
Route::middleware(['auth:sanctum', FirstPartyAdminTransport::class, 'superadmin'])
    ->prefix('v1/admin')
    ->group(function () {
        Route::prefix('crossings')->group(function () {
            Route::get('/', [CrossingAdminController::class, 'index'])
                ->name('api.v1.admin.crossings.index');
            Route::post('/', [CrossingAdminController::class, 'store'])
                ->name('api.v1.admin.crossings.store');
            Route::put('/{id}', [CrossingAdminController::class, 'update'])
                ->whereNumber('id')
                ->name('api.v1.admin.crossings.update');
            Route::patch('/{id}', [CrossingAdminController::class, 'update'])
                ->whereNumber('id');
            Route::delete('/{id}', [CrossingAdminController::class, 'destroy'])
                ->whereNumber('id')
                ->name('api.v1.admin.crossings.destroy');
        });

        Route::prefix('sites')->group(function () {
            Route::get('/', [SyrianSiteAdminController::class, 'index'])
                ->name('api.v1.admin.sites.index');
            Route::post('/', [SyrianSiteAdminController::class, 'store'])
                ->name('api.v1.admin.sites.store');
            Route::put('/{id}', [SyrianSiteAdminController::class, 'update'])
                ->whereNumber('id')
                ->name('api.v1.admin.sites.update');
            Route::patch('/{id}', [SyrianSiteAdminController::class, 'update'])
                ->whereNumber('id');
            Route::delete('/{id}', [SyrianSiteAdminController::class, 'destroy'])
                ->whereNumber('id')
                ->name('api.v1.admin.sites.destroy');
        });

        Route::prefix('house/members')->group(function () {
            Route::get('/', [HouseAdminController::class, 'index'])
                ->name('api.v1.admin.house.members.index');
            Route::post('/', [HouseAdminController::class, 'store'])
                ->name('api.v1.admin.house.members.store');
            Route::put('/{id}', [HouseAdminController::class, 'update'])
                ->whereNumber('id')
                ->name('api.v1.admin.house.members.update');
            Route::patch('/{id}', [HouseAdminController::class, 'update'])
                ->whereNumber('id');
            Route::delete('/{id}', [HouseAdminController::class, 'destroy'])
                ->whereNumber('id')
                ->name('api.v1.admin.house.members.destroy');
        });
    });
