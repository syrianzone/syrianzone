<?php

use App\Http\Controllers\Admin\CivicAdminPagesController;
use Illuminate\Support\Facades\Route;

// Inertia admin CRUD pages for Crossings, Syrian Sites, and House Members 2026.
// Intended to be required from routes/web.php.
Route::middleware(['auth', 'superadmin'])->group(function () {
    Route::get('/admin/crossings', [CivicAdminPagesController::class, 'crossings'])
        ->name('admin.crossings.index');

    Route::get('/admin/sites', [CivicAdminPagesController::class, 'sites'])
        ->name('admin.sites.index');

    Route::get('/admin/house', [CivicAdminPagesController::class, 'house'])
        ->name('admin.house.index');
});
