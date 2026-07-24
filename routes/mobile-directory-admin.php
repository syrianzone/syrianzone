<?php

use App\Http\Controllers\Mobile\GovAppsAdminController;
use App\Http\Controllers\Mobile\PhonebookAdminController;
use App\Http\Controllers\Mobile\SyOfficialAdminController;
use App\Http\Middleware\EnsureMobileBearerToken;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile/admin')
    ->name('mobile.admin.directories.')
    ->middleware([EnsureMobileBearerToken::class, 'throttle:60,1'])
    ->group(function () {
        Route::prefix('syofficial')->name('syofficial.')->group(function () {
            Route::get('/', [SyOfficialAdminController::class, 'index'])->name('index');
            Route::post('/categories', [SyOfficialAdminController::class, 'storeCategory'])->name('categories.store');
            Route::put('/categories/{id}', [SyOfficialAdminController::class, 'updateCategory'])->name('categories.update');
            Route::delete('/categories/{id}', [SyOfficialAdminController::class, 'destroyCategory'])->name('categories.destroy');
            Route::post('/entities', [SyOfficialAdminController::class, 'storeEntity'])->name('entities.store');
            Route::post('/entities/{id}', [SyOfficialAdminController::class, 'updateEntity'])->name('entities.update');
            Route::patch('/entities/{id}/visibility', [SyOfficialAdminController::class, 'updateEntityVisibility'])
                ->name('entities.visibility');
            Route::delete('/entities/{id}', [SyOfficialAdminController::class, 'destroyEntity'])->name('entities.destroy');
            Route::post('/reorder/categories', [SyOfficialAdminController::class, 'reorderCategories'])
                ->name('categories.reorder');
            Route::post('/reorder/entities', [SyOfficialAdminController::class, 'reorderEntities'])
                ->name('entities.reorder');
        });

        Route::prefix('govapps')->name('govapps.')->group(function () {
            Route::get('/', [GovAppsAdminController::class, 'index'])->name('index');
            Route::post('/', [GovAppsAdminController::class, 'store'])->name('store');
            Route::post('/reorder', [GovAppsAdminController::class, 'reorder'])->name('reorder');
            Route::post('/{id}', [GovAppsAdminController::class, 'update'])->name('update');
            Route::patch('/{id}/visibility', [GovAppsAdminController::class, 'updateVisibility'])->name('visibility');
            Route::delete('/{id}', [GovAppsAdminController::class, 'destroy'])->name('destroy');
        });

        Route::prefix('phonebook')->name('phonebook.')->group(function () {
            Route::get('/', [PhonebookAdminController::class, 'index'])->name('index');
            Route::post('/categories', [PhonebookAdminController::class, 'storeCategory'])->name('categories.store');
            Route::put('/categories/{id}', [PhonebookAdminController::class, 'updateCategory'])->name('categories.update');
            Route::delete('/categories/{id}', [PhonebookAdminController::class, 'destroyCategory'])->name('categories.destroy');
            Route::post('/entries', [PhonebookAdminController::class, 'storeEntry'])->name('entries.store');
            Route::put('/entries/{id}', [PhonebookAdminController::class, 'updateEntry'])->name('entries.update');
            Route::patch('/entries/{id}/visibility', [PhonebookAdminController::class, 'updateEntryVisibility'])
                ->name('entries.visibility');
            Route::delete('/entries/{id}', [PhonebookAdminController::class, 'destroyEntry'])->name('entries.destroy');
            Route::post('/reorder/categories', [PhonebookAdminController::class, 'reorderCategories'])
                ->name('categories.reorder');
            Route::post('/reorder/entries', [PhonebookAdminController::class, 'reorderEntries'])
                ->name('entries.reorder');
        });
    });
