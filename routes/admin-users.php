<?php

use App\Http\Controllers\Admin\UsersAdminController;
use App\Http\Middleware\FirstPartyAdminTransport;
use Illuminate\Support\Facades\Route;

// Inertia Users & Permissions Manager (required from routes/web.php).
// Superadmins automatically satisfy `users_admin:users.ban`.
Route::middleware(['auth', 'users_admin:users.ban'])
    ->get('/admin/users', [UsersAdminController::class, 'index'])
    ->name('admin.users.index');

// JSON Admin API for Users CRUD (PATCH /api/v1/admin/users/{id}/ban already
// lives in routes/web.php via DashboardController::toggleBan).
Route::middleware(['auth:sanctum', FirstPartyAdminTransport::class, 'throttle:120,1'])
    ->prefix('api/v1/admin/users')
    ->group(function () {
        Route::middleware('superadmin')->group(function () {
            Route::post('/', [UsersAdminController::class, 'store'])
                ->name('api.v1.admin.users.store');
            Route::put('/{id}', [UsersAdminController::class, 'update'])
                ->whereNumber('id')
                ->name('api.v1.admin.users.update');
            Route::delete('/{id}', [UsersAdminController::class, 'destroy'])
                ->whereNumber('id')
                ->name('api.v1.admin.users.destroy');
            Route::post('/{id}/restore', [UsersAdminController::class, 'restore'])
                ->whereNumber('id')
                ->name('api.v1.admin.users.restore');
        });
    });
