<?php

use App\Http\Controllers\Mobile\PublicContentController;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile')->name('mobile.public.')->group(function () {
    Route::get('/home', [PublicContentController::class, 'home'])->name('home');
    Route::get('/official-accounts', [PublicContentController::class, 'officialAccounts'])->name('official-accounts');
    Route::get('/phonebook', [PublicContentController::class, 'phonebook'])->name('phonebook');
    Route::get('/sites', [PublicContentController::class, 'sites'])->name('sites');
    Route::get('/parties', [PublicContentController::class, 'parties'])->name('parties');
    Route::get('/government-apps', [PublicContentController::class, 'governmentApps'])->name('government-apps');
    Route::get('/house', [PublicContentController::class, 'house'])->name('house');
    Route::get('/contributors', [PublicContentController::class, 'contributors'])->name('contributors');
    Route::get('/contributors/{username}', [PublicContentController::class, 'contributor'])->name('contributor');
    Route::get('/transit/cities/{cityId}/routes/{routeId}', [PublicContentController::class, 'transitRoute'])->name('transit-route');
});
