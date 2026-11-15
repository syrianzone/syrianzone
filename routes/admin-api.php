<?php

use App\Http\Controllers\ApiTokenAdminController;
use App\Http\Controllers\AssetUploadController;
use App\Http\Controllers\CompassAdminController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\GovAppsAdminController;
use App\Http\Controllers\GuessWhoAdminController;
use App\Http\Controllers\PhonebookAdminController;
use App\Http\Controllers\PlaceAdminController;
use App\Http\Controllers\PlaceReportController;
use App\Http\Controllers\PromisesAdminController;
use App\Http\Controllers\SiteNavigationAdminController;
use App\Http\Controllers\SitePopupAdminController;
use App\Http\Controllers\SyOfficialAdminController;
use App\Http\Controllers\TransitAdminController;
use App\Http\Controllers\TransitImportController;
use App\Http\Controllers\UserAdminController;
use App\Http\Middleware\FirstPartyAdminTransport;
use Illuminate\Support\Facades\Route;

// Canonical administration keeps token authentication separate from browser CSRF.
Route::middleware(['auth:sanctum', FirstPartyAdminTransport::class])->group(function () {
    $promisesRescheduleRoutes = require __DIR__.'/promises-reschedule.php';

    Route::middleware('superadmin')->group(function () {
        Route::prefix('v1/admin/users')->group(function () {
            Route::get('/options', [UserAdminController::class, 'options']);
            Route::get('/', [UserAdminController::class, 'index']);
            Route::post('/', [UserAdminController::class, 'store']);
            Route::post('/bulk', [UserAdminController::class, 'bulk']);
            Route::get('/{id}', [UserAdminController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [UserAdminController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [UserAdminController::class, 'destroy'])->whereNumber('id');
            Route::post('/{id}/restore', [UserAdminController::class, 'restore'])->whereNumber('id');
            Route::delete('/{id}/force', [UserAdminController::class, 'forceDestroy'])->whereNumber('id');
        });

        Route::delete('/v1/admin/users/{userId}/api-tokens', [ApiTokenAdminController::class, 'revokeAllForUser'])
            ->whereNumber('userId')
            ->middleware('agent_tokens')
            ->name('api.v1.admin.users.api-tokens.destroy-all');

        Route::post('/v1/admin/api-tokens/revoke-all/{userId}', [ApiTokenAdminController::class, 'revokeAllForUser'])
            ->whereNumber('userId')
            ->middleware('agent_tokens');
    });

    Route::middleware('assets_admin')->group(function () {
        Route::prefix('v1/admin/assets')->group(function () {
            Route::get('/list', [AssetUploadController::class, 'list'])
                ->middleware('assets_admin:assets.manage');
            Route::post('/upload', [AssetUploadController::class, 'store'])
                ->middleware('assets_admin:assets.manage');
            Route::delete('/delete', [AssetUploadController::class, 'destroy'])
                ->middleware('assets_admin:assets.manage');
        });
    });

    Route::middleware('site_admin')->group(function () {
        Route::get('/v1/admin/site-popup', [SitePopupAdminController::class, 'show'])
            ->middleware('site_admin:site.popup')
            ->name('api.v1.admin.site-popup.show');

        Route::put('/v1/admin/site-popup', [SitePopupAdminController::class, 'update'])
            ->middleware('site_admin:site.popup')
            ->name('api.v1.admin.site-popup.update');

        Route::get('/v1/admin/navigation', [SiteNavigationAdminController::class, 'show'])
            ->middleware('site_admin:site.navigation')
            ->name('api.v1.admin.navigation.show');

        Route::put('/v1/admin/navigation', [SiteNavigationAdminController::class, 'update'])
            ->middleware('site_admin:site.navigation')
            ->name('api.v1.admin.navigation.update');
    });

    Route::middleware('agent_tokens')->group(function () {
        Route::post('/v1/admin/api-tokens', [ApiTokenAdminController::class, 'store'])
            ->name('api.v1.admin.api-tokens.store');

        Route::delete('/v1/admin/api-tokens/{id}', [ApiTokenAdminController::class, 'destroy'])
            ->whereNumber('id')
            ->name('api.v1.admin.api-tokens.destroy');
    });

    Route::middleware('guesswho_admin')->group(function () {
        Route::prefix('v1/admin/guesswho')->group(function () {
            Route::post('/categories', [GuessWhoAdminController::class, 'storeCategory'])
                ->middleware('guesswho_admin:guesswho.manage')
                ->name('api.v1.admin.guesswho.categories.store');
            Route::post('/categories/{id}', [GuessWhoAdminController::class, 'updateCategory'])
                ->whereNumber('id')
                ->middleware('guesswho_admin:guesswho.manage');
            Route::put('/categories/{id}', [GuessWhoAdminController::class, 'updateCategory'])
                ->whereNumber('id')
                ->middleware('guesswho_admin:guesswho.manage')
                ->name('api.v1.admin.guesswho.categories.update');
            Route::delete('/categories/{id}', [GuessWhoAdminController::class, 'destroyCategory'])
                ->whereNumber('id')
                ->middleware('guesswho_admin:guesswho.manage')
                ->name('api.v1.admin.guesswho.categories.destroy');

            Route::post('/characters', [GuessWhoAdminController::class, 'storeCharacter'])
                ->middleware('guesswho_admin:guesswho.manage')
                ->name('api.v1.admin.guesswho.characters.store');
            Route::post('/characters/{id}', [GuessWhoAdminController::class, 'updateCharacter'])
                ->whereNumber('id')
                ->middleware('guesswho_admin:guesswho.manage');
            Route::put('/characters/{id}', [GuessWhoAdminController::class, 'updateCharacter'])
                ->whereNumber('id')
                ->middleware('guesswho_admin:guesswho.manage')
                ->name('api.v1.admin.guesswho.characters.update');
            Route::delete('/characters/{id}', [GuessWhoAdminController::class, 'destroyCharacter'])
                ->whereNumber('id')
                ->middleware('guesswho_admin:guesswho.manage')
                ->name('api.v1.admin.guesswho.characters.destroy');
        });
    });

    Route::middleware('places_admin')->group(function () {
        Route::prefix('v1')->middleware('throttle:60,1')->group(function () {
            Route::get('/admin/places', [PlaceAdminController::class, 'index'])
                ->middleware('places_admin:places.review')
                ->name('api.v1.admin.places.index');
            Route::post('/admin/places/{id}/approve', [PlaceAdminController::class, 'approve'])->whereNumber('id')
                ->middleware('places_admin:places.approve')
                ->name('api.v1.admin.places.approve');
            Route::post('/admin/places/{id}/reject', [PlaceAdminController::class, 'reject'])->whereNumber('id')
                ->middleware('places_admin:places.approve')
                ->name('api.v1.admin.places.reject');
            Route::patch('/admin/places/{id}', [PlaceAdminController::class, 'update'])->whereNumber('id')
                ->middleware('places_admin:places.edit')
                ->name('api.v1.admin.places.update');
            Route::delete('/admin/places/{id}', [PlaceAdminController::class, 'destroy'])->whereNumber('id')
                ->middleware('places_admin:places.delete')
                ->name('api.v1.admin.places.destroy');
            // Adding a photo creates content on someone else's submission, so it
            // is an edit of the place, not a photo-moderation action. Rotating,
            // replacing and deleting operate on photos that already exist, which
            // is what places.moderate_photos covers.
            Route::post('/admin/places/{id}/photos', [PlaceAdminController::class, 'addPhoto'])->whereNumber('id')
                ->middleware('places_admin:places.edit')
                ->name('api.v1.admin.places.photos.store');
            Route::post('/admin/place-photos/{id}/rotate', [PlaceAdminController::class, 'rotatePhoto'])->whereNumber('id')
                ->middleware('places_admin:places.moderate_photos')
                ->name('api.v1.admin.place-photos.rotate');
            Route::post('/admin/place-photos/{id}/replace', [PlaceAdminController::class, 'replacePhoto'])->whereNumber('id')
                ->middleware('places_admin:places.moderate_photos')
                ->name('api.v1.admin.place-photos.replace');
            Route::delete('/admin/place-photos/{id}', [PlaceAdminController::class, 'deletePhoto'])->whereNumber('id')
                ->middleware('places_admin:places.moderate_photos')
                ->name('api.v1.admin.place-photos.destroy');
            Route::get('/admin/place-reports', [PlaceReportController::class, 'index'])
                ->middleware('places_admin:places.review')
                ->name('api.v1.admin.place-reports.index');
            // Upholding a report unpublishes the place, which is an approval decision.
            Route::post('/admin/place-reports/{id}/resolve', [PlaceReportController::class, 'resolve'])->whereNumber('id')
                ->middleware('places_admin:places.approve')
                ->name('api.v1.admin.place-reports.resolve');
        });
    });

    Route::middleware('transit_admin')->group(function () {
        Route::prefix('v1/admin')->group(function () {
            Route::get('/route-drafts', [TransitAdminController::class, 'index'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::post('/route-drafts/{id}/approve', [TransitAdminController::class, 'approve'])
                ->middleware('transit_admin:transit.approve');
            Route::post('/route-drafts/{id}/reject', [TransitAdminController::class, 'reject'])
                ->middleware('transit_admin:transit.reject');

            Route::get('/routes', [TransitAdminController::class, 'getPublishedRoutes'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::get('/routes/logs', [TransitAdminController::class, 'getLogs'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::get('/routes/{id}/geojson', [TransitAdminController::class, 'getRouteGeoJson'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::patch('/routes/{id}/status', [TransitAdminController::class, 'updateRouteStatus'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/routes/{id}/status', [TransitAdminController::class, 'updateRouteStatus'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::put('/routes/{id}', [TransitAdminController::class, 'updateRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::delete('/routes/{id}', [TransitAdminController::class, 'destroy'])
                ->middleware('transit_admin:transit.delete_routes');
            Route::post('/routes/{id}/move', [TransitAdminController::class, 'moveRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/routes/combine', [TransitAdminController::class, 'combineRoutes'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/routes/split', [TransitAdminController::class, 'splitRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::get('/routes/{id}/stops', [TransitAdminController::class, 'getRouteStops'])
                ->middleware('transit_admin:transit.review_drafts');
            // Preview responses are cached per-mid for an hour, so repeated
            // reviews are cheap: allow an admin-friendly rate instead of
            // blocking legitimate retry loops with 429s.
            Route::post('/routes/import-preview', [TransitImportController::class, 'preview'])
                ->middleware(['transit_admin:transit.review_drafts', 'throttle:30,1']);
            Route::post('/routes/import-publish', [TransitImportController::class, 'publish'])
                ->middleware(['transit_admin:transit.edit_routes', 'throttle:30,1']);
        });
    });

    Route::middleware('users_admin')->group(function () {
        Route::patch('/v1/admin/users/{id}/ban', [DashboardController::class, 'toggleBan'])
            ->middleware('users_admin:users.ban')
            ->name('api.v1.admin.users.ban');

        Route::post('/v1/admin/users/{id}/toggle-ban', [DashboardController::class, 'toggleBan'])
            ->middleware('users_admin:users.ban');
    });

    Route::middleware('syofficial_admin')->group(function () {
        Route::prefix('v1/admin/syofficial')->group(function () {
            Route::post('/categories', [SyOfficialAdminController::class, 'storeCategory'])
                ->middleware('syofficial_admin:syofficial.create')
                ->name('api.v1.admin.syofficial.categories.store');
            Route::post('/categories/reorder', [SyOfficialAdminController::class, 'reorderCategories'])
                ->middleware('syofficial_admin:syofficial.reorder')
                ->name('api.v1.admin.syofficial.categories.reorder');
            Route::put('/categories/{id}', [SyOfficialAdminController::class, 'updateCategory'])
                ->middleware('syofficial_admin:syofficial.edit')
                ->name('api.v1.admin.syofficial.categories.update');
            // Cascades to every entity in the category, so it is gated on delete
            // alone and not on any of the other four.
            Route::delete('/categories/{id}', [SyOfficialAdminController::class, 'destroyCategory'])
                ->middleware('syofficial_admin:syofficial.delete')
                ->name('api.v1.admin.syofficial.categories.destroy');

            Route::post('/entities', [SyOfficialAdminController::class, 'storeEntity'])
                ->middleware('syofficial_admin:syofficial.create')
                ->name('api.v1.admin.syofficial.entities.store');
            // Before {id}: a static segment must not be swallowed by the update
            // route, which is what made this unreachable.
            Route::post('/entities/reorder', [SyOfficialAdminController::class, 'reorderEntities'])
                ->middleware('syofficial_admin:syofficial.reorder')
                ->name('api.v1.admin.syofficial.entities.reorder');
            Route::post('/entities/{id}', [SyOfficialAdminController::class, 'updateEntity'])
                ->middleware('syofficial_admin:syofficial.edit');
            Route::put('/entities/{id}', [SyOfficialAdminController::class, 'updateEntity'])
                ->middleware('syofficial_admin:syofficial.edit')
                ->name('api.v1.admin.syofficial.entities.update');
            Route::delete('/entities/{id}', [SyOfficialAdminController::class, 'destroyEntity'])
                ->middleware('syofficial_admin:syofficial.delete')
                ->name('api.v1.admin.syofficial.entities.destroy');
        });
    });

    Route::middleware('govapps_admin')->group(function () {
        Route::prefix('v1/admin/govapps')->group(function () {
            Route::post('/', [GovAppsAdminController::class, 'store'])
                ->middleware('govapps_admin:govapps.create')
                ->name('api.v1.admin.govapps.store');
            Route::post('/reorder', [GovAppsAdminController::class, 'reorder'])
                ->middleware('govapps_admin:govapps.reorder')
                ->name('api.v1.admin.govapps.reorder');
            Route::post('/{id}', [GovAppsAdminController::class, 'update'])
                ->middleware('govapps_admin:govapps.edit');
            Route::put('/{id}', [GovAppsAdminController::class, 'update'])
                ->middleware('govapps_admin:govapps.edit')
                ->name('api.v1.admin.govapps.update');
            Route::delete('/{id}', [GovAppsAdminController::class, 'destroy'])
                ->middleware('govapps_admin:govapps.delete')
                ->name('api.v1.admin.govapps.destroy');
        });
    });

    Route::middleware('phonebook_admin')->group(function () {
        Route::prefix('v1/admin/phonebook')->group(function () {
            Route::post('/categories', [PhonebookAdminController::class, 'storeCategory'])
                ->middleware('phonebook_admin:phonebook.create')
                ->name('api.v1.admin.phonebook.categories.store');
            Route::post('/categories/reorder', [PhonebookAdminController::class, 'reorderCategories'])
                ->middleware('phonebook_admin:phonebook.reorder')
                ->name('api.v1.admin.phonebook.categories.reorder');
            Route::put('/categories/{id}', [PhonebookAdminController::class, 'updateCategory'])
                ->middleware('phonebook_admin:phonebook.edit')
                ->name('api.v1.admin.phonebook.categories.update');
            Route::delete('/categories/{id}', [PhonebookAdminController::class, 'destroyCategory'])
                ->middleware('phonebook_admin:phonebook.delete')
                ->name('api.v1.admin.phonebook.categories.destroy');

            Route::post('/entries', [PhonebookAdminController::class, 'storeEntry'])
                ->middleware('phonebook_admin:phonebook.create')
                ->name('api.v1.admin.phonebook.entries.store');
            // Before {id}: a static segment must not be swallowed by the
            // update route, which is what made this unreachable.
            Route::post('/entries/reorder', [PhonebookAdminController::class, 'reorderEntries'])
                ->middleware('phonebook_admin:phonebook.reorder')
                ->name('api.v1.admin.phonebook.entries.reorder');
            Route::post('/entries/{id}', [PhonebookAdminController::class, 'updateEntry'])
                ->middleware('phonebook_admin:phonebook.edit');
            Route::put('/entries/{id}', [PhonebookAdminController::class, 'updateEntry'])
                ->middleware('phonebook_admin:phonebook.edit')
                ->name('api.v1.admin.phonebook.entries.update');
            Route::patch('/entries/{id}/toggle', [PhonebookAdminController::class, 'toggleEntryActive'])
                ->middleware('phonebook_admin:phonebook.toggle')
                ->name('api.v1.admin.phonebook.entries.toggle');
            Route::post('/entries/{id}/toggle', [PhonebookAdminController::class, 'toggleEntryActive'])
                ->middleware('phonebook_admin:phonebook.toggle');
            Route::delete('/entries/{id}', [PhonebookAdminController::class, 'destroyEntry'])
                ->middleware('phonebook_admin:phonebook.delete')
                ->name('api.v1.admin.phonebook.entries.destroy');
        });
    });

    Route::middleware('compass_admin')->group(function () {
        Route::prefix('v1/admin/compass/figures')
            ->middleware('compass_admin:compass.figures')
            ->group(function () {
                Route::get('/', [CompassAdminController::class, 'figuresList'])
                    ->name('api.v1.admin.compass.figures.index');
                Route::post('/', [CompassAdminController::class, 'storeFigure'])
                    ->name('api.v1.admin.compass.figures.store');
                Route::post('/upload-image', [CompassAdminController::class, 'uploadFigureImage'])
                    ->name('api.v1.admin.compass.figures.upload-image');
                Route::put('/{id}', [CompassAdminController::class, 'updateFigure'])
                    ->whereNumber('id')
                    ->name('api.v1.admin.compass.figures.update');
                Route::delete('/{id}', [CompassAdminController::class, 'destroyFigure'])
                    ->whereNumber('id')
                    ->name('api.v1.admin.compass.figures.destroy');
                Route::patch('/{id}/toggle', [CompassAdminController::class, 'toggleFigure'])
                    ->whereNumber('id')
                    ->name('api.v1.admin.compass.figures.toggle');
                Route::post('/{id}/toggle', [CompassAdminController::class, 'toggleFigure'])->whereNumber('id');
            });

        Route::prefix('v1/admin/compass/personas')
            ->middleware('compass_admin:compass.personas')
            ->group(function () {
                Route::get('/', [CompassAdminController::class, 'personasList'])
                    ->name('api.v1.admin.compass.personas.index');
                Route::post('/', [CompassAdminController::class, 'storePersona'])
                    ->name('api.v1.admin.compass.personas.store');
                Route::put('/{id}', [CompassAdminController::class, 'updatePersona'])
                    ->whereNumber('id')
                    ->name('api.v1.admin.compass.personas.update');
                Route::delete('/{id}', [CompassAdminController::class, 'destroyPersona'])
                    ->whereNumber('id')
                    ->name('api.v1.admin.compass.personas.destroy');
                Route::patch('/{id}/toggle', [CompassAdminController::class, 'togglePersona'])
                    ->whereNumber('id')
                    ->name('api.v1.admin.compass.personas.toggle');
                Route::post('/{id}/toggle', [CompassAdminController::class, 'togglePersona'])->whereNumber('id');
            });
    });

    Route::middleware('promises_admin')->group(function () use ($promisesRescheduleRoutes) {
        Route::prefix('v1/admin/promises')->middleware('throttle:120,1')->group(function () use ($promisesRescheduleRoutes) {
            Route::get('/speakers/search', [PromisesAdminController::class, 'searchSpeakers'])
                ->middleware('promises_admin:any')
                ->name('api.v1.admin.promises.speakers.search');
            Route::post('/upload-image', [PromisesAdminController::class, 'uploadImage'])
                ->middleware('promises_admin:promises.edit')
                ->name('api.v1.admin.promises.upload-image');
            Route::post('/speakers/upload-image', [PromisesAdminController::class, 'uploadImage'])
                ->middleware('promises_admin:promises.speakers')
                ->name('api.v1.admin.promises.speakers.upload-image');

            Route::post('/', [PromisesAdminController::class, 'store'])
                ->middleware('promises_admin:promises.create')
                ->name('api.v1.admin.promises.store');
            Route::put('/{id}', [PromisesAdminController::class, 'update'])
                ->whereUuid('id')->middleware('promises_admin:promises.edit')
                ->name('api.v1.admin.promises.update');
            Route::delete('/{id}', [PromisesAdminController::class, 'destroy'])
                ->whereUuid('id')->middleware('promises_admin:promises.delete')
                ->name('api.v1.admin.promises.destroy');
            Route::post('/{id}/status', [PromisesAdminController::class, 'changeStatus'])
                ->whereUuid('id')->middleware('promises_admin:promises.rule')
                ->name('api.v1.admin.promises.status');
            Route::delete('/{id}/status/{updateId}', [PromisesAdminController::class, 'undoStatusChange'])
                ->whereUuid('id')->whereNumber('updateId')->middleware('promises_admin:promises.rule')
                ->name('api.v1.admin.promises.status.undo');
            $promisesRescheduleRoutes('api.v1.admin.promises.reschedule');
            Route::post('/{id}/updates', [PromisesAdminController::class, 'addUpdate'])
                ->whereUuid('id')->middleware('promises_admin:promises.edit')
                ->name('api.v1.admin.promises.updates.store');
            Route::delete('/{id}/updates/{updateId}', [PromisesAdminController::class, 'removeUpdate'])
                ->whereUuid('id')->whereNumber('updateId')->middleware('promises_admin:promises.edit')
                ->name('api.v1.admin.promises.updates.destroy');
            Route::post('/{id}/publish', [PromisesAdminController::class, 'publish'])
                ->whereUuid('id')->middleware('promises_admin:promises.review')
                ->name('api.v1.admin.promises.publish');
            Route::post('/{id}/unpublish', [PromisesAdminController::class, 'unpublish'])
                ->whereUuid('id')->middleware('promises_admin:promises.review')
                ->name('api.v1.admin.promises.unpublish');
            Route::post('/{id}/reject', [PromisesAdminController::class, 'reject'])
                ->whereUuid('id')->middleware('promises_admin:promises.review')
                ->name('api.v1.admin.promises.reject');

            Route::post('/speakers', [PromisesAdminController::class, 'storeSpeaker'])
                ->middleware('promises_admin:promises.speakers')
                ->name('api.v1.admin.promises.speakers.store');
            Route::put('/speakers/{id}', [PromisesAdminController::class, 'updateSpeaker'])
                ->whereUuid('id')->middleware('promises_admin:promises.speakers')
                ->name('api.v1.admin.promises.speakers.update');
            Route::delete('/speakers/{id}', [PromisesAdminController::class, 'destroySpeaker'])
                ->whereUuid('id')->middleware('promises_admin:promises.speakers')
                ->name('api.v1.admin.promises.speakers.destroy');
            Route::post('/speakers/{id}/approve', [PromisesAdminController::class, 'approveSpeaker'])
                ->whereUuid('id')->middleware('promises_admin:promises.review')
                ->name('api.v1.admin.promises.speakers.approve');
            Route::post('/speakers/{id}/reject', [PromisesAdminController::class, 'rejectSpeaker'])
                ->whereUuid('id')->middleware('promises_admin:promises.review')
                ->name('api.v1.admin.promises.speakers.reject');

            Route::post('/reports/{id}/accept', [PromisesAdminController::class, 'acceptReport'])
                ->whereNumber('id')->middleware('promises_admin:promises.review')
                ->name('api.v1.admin.promises.reports.accept');
            Route::post('/reports/{id}/dismiss', [PromisesAdminController::class, 'dismissReport'])
                ->whereNumber('id')->middleware('promises_admin:promises.review')
                ->name('api.v1.admin.promises.reports.dismiss');

            Route::post('/sectors', [PromisesAdminController::class, 'storeSector'])
                ->middleware('promises_admin:promises.speakers')
                ->name('api.v1.admin.promises.sectors.store');
            Route::post('/sectors/reorder', [PromisesAdminController::class, 'reorderSectors'])
                ->middleware('promises_admin:promises.speakers')
                ->name('api.v1.admin.promises.sectors.reorder');
            Route::put('/sectors/{id}', [PromisesAdminController::class, 'updateSector'])
                ->middleware('promises_admin:promises.speakers')
                ->name('api.v1.admin.promises.sectors.update');
            Route::patch('/sectors/{id}/toggle', [PromisesAdminController::class, 'toggleSector'])
                ->middleware('promises_admin:promises.speakers')
                ->name('api.v1.admin.promises.sectors.toggle');
            Route::delete('/sectors/{id}', [PromisesAdminController::class, 'destroySector'])
                ->middleware('promises_admin:promises.speakers')
                ->name('api.v1.admin.promises.sectors.destroy');
        });
    });

    Route::prefix('v1/admin')->middleware('polls_admin')->group((require __DIR__.'/poll-management.php')(true));
});
