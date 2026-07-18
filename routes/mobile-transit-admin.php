<?php

use App\Http\Controllers\TransitAdminController;
use App\Http\Middleware\EnsureMobileBearerToken;
use Illuminate\Support\Facades\Route;

Route::middleware([EnsureMobileBearerToken::class, 'transit_admin'])
    ->prefix('mobile/admin')
    ->name('mobile.admin.transit.')
    ->group(function () {
        Route::get('/transit-drafts', [TransitAdminController::class, 'index'])->name('index');
        Route::post('/transit-drafts/{id}/approve', [TransitAdminController::class, 'approve'])->name('approve');
        Route::post('/transit-drafts/{id}/reject', [TransitAdminController::class, 'reject'])->name('reject');
    });
