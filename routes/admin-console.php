<?php

use App\Http\Controllers\Admin\AdminOverviewController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::get('/admin', [AdminOverviewController::class, 'index'])
        ->name('admin.index');

    Route::get('/admin/polls', [AdminOverviewController::class, 'polls'])
        ->middleware('polls_admin:any')
        ->name('admin.polls.index');
});
