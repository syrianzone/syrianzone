<?php

use App\Http\Controllers\AnswersController;
use App\Http\Controllers\Api\CompassResultController;
use App\Http\Controllers\Api\CompassShareController;
use App\Http\Controllers\Api\CompassStatsController;
use App\Http\Controllers\Api\PopulationAtlasController;
use App\Http\Controllers\Api\V1\GlobalSearchController;
use App\Http\Controllers\Api\V1\PoiSearchController;
use App\Http\Controllers\Api\V1\TransitController;
use App\Http\Controllers\Api\V1\VotingDataController;
use App\Http\Controllers\AppIconController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\ContributorController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EventsController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\HotelController;
use App\Http\Controllers\MetricsController;
use App\Http\Controllers\PlaceController;
use App\Http\Controllers\PlaceDiscoveryController;
use App\Http\Controllers\PlaceEngagementController;
use App\Http\Controllers\PollController;
use App\Http\Controllers\PrayerController;
use App\Http\Controllers\QuranBookmarkController;
use App\Http\Controllers\RadioUsageController;
use App\Http\Controllers\RecipeController;
use App\Http\Controllers\SiteNavigationAdminController;
use App\Http\Controllers\TransitStudioController;
use App\Http\Controllers\UserSettingsController;
use App\Http\Controllers\WeatherController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Canonical Versioned API Routes (/api/v1/*)
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // 0. Cross-Platform Authentication, Account, User Preferences & Dynamic Navigation Catalog
    Route::prefix('auth')->group(function () {
        Route::post('/google/token', [AuthController::class, 'googleToken'])
            ->middleware('throttle:20,1')
            ->name('api.v1.auth.google.token');
        Route::post('/google', [AuthController::class, 'googleToken'])
            ->middleware('throttle:20,1');
        Route::get('/user', [AuthController::class, 'user'])
            ->middleware('throttle:60,1')
            ->name('api.v1.auth.user');

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', [AuthController::class, 'apiLogout'])
                ->middleware('throttle:30,1')
                ->name('api.v1.auth.logout');
            Route::post('/logout-devices', [AuthController::class, 'apiLogoutAllDevices'])
                ->middleware('throttle:10,1')
                ->name('api.v1.auth.logout-devices');
        });
    });

    Route::middleware('auth:sanctum')->group(function () {
        // Shares one definition with the Inertia payload so /user and the
        // initial page load can never disagree about the user's capabilities.
        Route::get('/user', [AuthController::class, 'user'])
            ->name('api.v1.user.show');

        Route::patch('/account', [DashboardController::class, 'updateAccount'])
            ->name('api.v1.account.update');
        Route::put('/account', [DashboardController::class, 'updateAccount']);
        Route::post('/account/avatar', [DashboardController::class, 'updateAvatar'])
            ->middleware('throttle:10,1')
            ->name('api.v1.account.avatar.store');
        Route::delete('/account', [DashboardController::class, 'deleteAccount'])
            ->name('api.v1.account.destroy');

        // User settings & Quran radio usage API endpoints
        Route::prefix('user')->group(function () {
            Route::patch('/settings', [UserSettingsController::class, 'update'])
                ->middleware('throttle:60,1')
                ->name('api.v1.user.settings.update');
            Route::put('/settings', [UserSettingsController::class, 'update'])
                ->middleware('throttle:60,1');
            Route::post('/settings', [UserSettingsController::class, 'update'])
                ->middleware('throttle:60,1');

            Route::post('/radio-usage', [RadioUsageController::class, 'add'])
                ->middleware('throttle:60,1')
                ->name('api.v1.user.radio-usage.store');
            Route::delete('/radio-usage', [RadioUsageController::class, 'clear'])
                ->middleware('throttle:10,1')
                ->name('api.v1.user.radio-usage.destroy');
        });

        // Board layout sync. Session + CSRF or Sanctum Bearer token.
        Route::get('/board', [BoardController::class, 'show'])
            ->middleware('throttle:60,1')
            ->name('api.v1.board.show');
        Route::put('/board', [BoardController::class, 'update'])
            ->middleware('throttle:60,1')
            ->name('api.v1.board.update');

        // Quran Ayah bookmarks (logged-in only). Session + CSRF or Sanctum Bearer token.
        Route::get('/quran-bookmarks', [QuranBookmarkController::class, 'index'])
            ->middleware('throttle:60,1')
            ->name('api.v1.quran-bookmarks.index');
        Route::post('/quran-bookmarks', [QuranBookmarkController::class, 'store'])
            ->middleware('throttle:60,1')
            ->name('api.v1.quran-bookmarks.store');
        Route::delete('/quran-bookmarks/{surah}/{ayah}', [QuranBookmarkController::class, 'destroy'])
            ->whereNumber('surah')->whereNumber('ayah')
            ->middleware('throttle:60,1')
            ->name('api.v1.quran-bookmarks.destroy');
    });

    Route::get('/navigation', [SiteNavigationAdminController::class, 'show'])
        ->middleware('throttle:60,1')
        ->name('api.v1.navigation.show');

    // 1. Cross-module global search
    Route::middleware('throttle:60,1')->group(function () {
        Route::get('/search/global', [GlobalSearchController::class, 'search'])
            ->name('api.v1.search.global');

        // Legacy alias for global search
        Route::get('/global-search', [GlobalSearchController::class, 'search']);
    });

    // 2. Transit API (nested under /api/v1/transit/*)
    Route::prefix('transit')->group(function () {
        Route::middleware('throttle:60,1')->group(function () {
            Route::get('/cities', [TransitController::class, 'cities'])
                ->name('api.v1.transit.cities.index');
            Route::get('/cities/{id}/routes', [TransitController::class, 'routes'])
                ->name('api.v1.transit.cities.routes.index');
            Route::get('/cities/{id}/map-data', [TransitController::class, 'mapData'])
                ->name('api.v1.transit.cities.map-data');
            Route::get('/cities/{id}/map', [TransitController::class, 'mapData'])
                ->name('api.v1.transit.cities.map');
            Route::get('/stops/nearby', [TransitController::class, 'nearbyStops'])
                ->name('api.v1.transit.stops.nearby');
            Route::get('/search', [TransitController::class, 'search'])
                ->name('api.v1.transit.search');
            Route::get('/pois', [PoiSearchController::class, 'search'])
                ->name('api.v1.transit.pois.index');
        });

        // Transit Studio: open for community contributions (supports optional session or Bearer token)
        Route::post('/studio/routes', [TransitStudioController::class, 'store'])
            ->middleware('throttle:studio-submit')
            ->name('api.v1.transit.studio.routes.store');

        // Transit Studio: list & manage existing drafts (requires auth via web session or Sanctum Bearer token)
        Route::middleware('auth:sanctum')->group(function () {
            Route::get('/studio/routes', [TransitStudioController::class, 'index'])
                ->middleware('throttle:60,1')
                ->name('api.v1.transit.studio.routes.index');
            Route::get('/studio/routes/{id}', [TransitStudioController::class, 'show'])
                ->name('api.v1.transit.studio.routes.show');
            Route::put('/studio/routes/{id}', [TransitStudioController::class, 'update'])
                ->middleware('throttle:60,1')
                ->name('api.v1.transit.studio.routes.update');
            Route::patch('/studio/routes/{id}', [TransitStudioController::class, 'update'])
                ->middleware('throttle:60,1');
            Route::delete('/studio/routes/{id}', [TransitStudioController::class, 'destroy'])
                ->middleware('throttle:10,1')
                ->name('api.v1.transit.studio.routes.destroy');
            Route::get('/studio/routes/{id}/from-route', [TransitStudioController::class, 'showForEdit'])
                ->name('api.v1.transit.studio.routes.from-route');
        });
    });

    // Legacy Transit & Geo aliases at root /api/v1/* (kept for backwards compatibility)
    Route::middleware('throttle:60,1')->group(function () {
        Route::get('/cities', [TransitController::class, 'getCities']);
        Route::get('/cities/{id}/routes', [TransitController::class, 'getRoutes']);
        Route::get('/cities/{id}/map-data', [TransitController::class, 'getMapData']);
        Route::get('/stops/nearby', [TransitController::class, 'getNearbyStops']);
        Route::get('/search', [TransitController::class, 'search']);
        // POI search (mosques, cafes…) for the transit map: Photon first,
        // Google Places fallback on thin results. Static path, no conflicts.
        Route::get('/geo/poi', [PoiSearchController::class, 'search']);
    });

    // Legacy Transit Studio aliases at /api/v1/studio/*
    Route::post('/studio/routes', [TransitStudioController::class, 'store'])
        ->middleware('throttle:studio-submit');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/studio/routes', [TransitStudioController::class, 'index'])
            ->middleware('throttle:60,1');
        Route::get('/studio/routes/{id}', [TransitStudioController::class, 'show']);
        // Authenticated iterative editing (admin geometry fixes, owner
        // resubmits): 10/min blocks legitimate rapid saving, so allow the
        // same coarse rate as the other authed read/write endpoints. The
        // anonymous create above stays at 5/min as the spam backstop.
        Route::put('/studio/routes/{id}', [TransitStudioController::class, 'update'])
            ->middleware('throttle:60,1');
        Route::delete('/studio/routes/{id}', [TransitStudioController::class, 'destroy'])
            ->middleware('throttle:10,1');
        Route::get('/studio/routes/{id}/from-route', [TransitStudioController::class, 'showForEdit']);
    });

    // 3. Syrian Compass: account results (auth:sanctum) + account-independent share & stats
    Route::prefix('compass')->group(function () {
        Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
            Route::get('/results', [CompassResultController::class, 'index'])
                ->name('api.v1.compass.results.index');
            Route::post('/results', [CompassResultController::class, 'store'])
                ->middleware('throttle:20,1')
                ->name('api.v1.compass.results.store');
            Route::delete('/results', [CompassResultController::class, 'destroyAll'])
                ->name('api.v1.compass.results.destroy-all');
            Route::delete('/results/{id}', [CompassResultController::class, 'destroy'])
                ->name('api.v1.compass.results.destroy');
        });
        // Share is account-independent: anyone can create/read a share key.
        Route::middleware('throttle:30,1')->group(function () {
            Route::post('/shares', [CompassShareController::class, 'store'])
                ->name('api.v1.compass.shares.store');
            Route::get('/shares/{shareId}', [CompassShareController::class, 'show'])
                ->name('api.v1.compass.shares.show');
            // Legacy singular /share aliases
            Route::post('/share', [CompassShareController::class, 'store']);
            Route::get('/share/{shareId}', [CompassShareController::class, 'show']);

            // Anonymous stats submission (opt-in), open to guests and users.
            Route::post('/stats', [CompassStatsController::class, 'store'])
                ->middleware('throttle:compass-stats')
                ->name('api.v1.compass.stats.store');
            Route::delete('/stats', [CompassStatsController::class, 'destroy'])
                ->name('api.v1.compass.stats.destroy');
        });
    });

    // 4. Hidden Places (Mishwar) & HalaSyria Hotels public reads + authenticated writes
    // Static /places/* paths must register before /places/{id}.
    Route::middleware('throttle:60,1')->group(function () {
        Route::get('/places/map', [PlaceController::class, 'mapData'])
            ->name('api.v1.places.map');
        Route::get('/places/nearby', [PlaceController::class, 'nearby'])
            ->name('api.v1.places.nearby');
        Route::get('/places/geocode', [PlaceController::class, 'geocode'])
            ->name('api.v1.places.geocode');
        Route::get('/places/photos', [PlaceDiscoveryController::class, 'photos'])
            ->name('api.v1.places.photos');
        Route::get('/places', [PlaceController::class, 'index'])
            ->name('api.v1.places.index');
        Route::get('/guides', [PlaceDiscoveryController::class, 'guides'])
            ->name('api.v1.guides.index');
        Route::get('/places/{id}', [PlaceController::class, 'show'])
            ->whereNumber('id')
            ->name('api.v1.places.show');

        // HalaSyria hotels (cached in local DB, synced every 2 days)
        Route::get('/hotels/map', [HotelController::class, 'mapData'])
            ->name('api.v1.hotels.map');
        Route::get('/hotels', [HotelController::class, 'index'])
            ->name('api.v1.hotels.index');
        Route::get('/hotels/{id}', [HotelController::class, 'show'])
            ->whereNumber('id')
            ->name('api.v1.hotels.show');
    });

    // Hidden Places: authenticated writes (session + CSRF or Sanctum Bearer token)
    Route::middleware('auth:sanctum')->group(function () {
        // No per-user submission cap: moderation gates everything to the public map,
        // so this throttle is only a flood backstop no normal use touches.
        Route::post('/places', [PlaceController::class, 'store'])
            ->middleware('throttle:60,1')
            ->name('api.v1.places.store');
        Route::get('/my/places', [PlaceController::class, 'mine'])
            ->middleware('throttle:60,1')
            ->name('api.v1.my.places.index');
        // Every accepted move re-enters the moderation queue, so mirror the
        // store() coarse shield instead of a per-minute rate.
        Route::patch('/my/places/{id}/location', [PlaceController::class, 'updateLocation'])
            ->whereNumber('id')->middleware('throttle:20,60')
            ->name('api.v1.my.places.location.update');
        // Owner mutations share the same coarse hourly shield: every accepted
        // content change re-enters the moderation queue.
        Route::patch('/my/places/{id}', [PlaceController::class, 'updateDetails'])
            ->whereNumber('id')->middleware('throttle:20,60')
            ->name('api.v1.my.places.update');
        Route::post('/my/places/{id}/photos', [PlaceController::class, 'addPhoto'])
            ->whereNumber('id')->middleware('throttle:20,60')
            ->name('api.v1.my.places.photos.store');
        Route::post('/my/places/{id}/resubmit', [PlaceController::class, 'resubmit'])
            ->whereNumber('id')->middleware('throttle:20,60')
            ->name('api.v1.my.places.resubmit');
        Route::delete('/my/places/{id}', [PlaceController::class, 'destroy'])
            ->whereNumber('id')->middleware('throttle:20,60')
            ->name('api.v1.my.places.destroy');
        Route::delete('/my/place-photos/{id}', [PlaceController::class, 'deletePhoto'])
            ->whereNumber('id')->middleware('throttle:20,60')
            ->name('api.v1.my.place-photos.destroy');
        Route::post('/my/place-photos/{id}/rotate', [PlaceController::class, 'rotatePhoto'])
            ->whereNumber('id')->middleware('throttle:20,60')
            ->name('api.v1.my.place-photos.rotate');
        Route::get('/my/saves', [PlaceEngagementController::class, 'mySaves'])
            ->middleware('throttle:60,1')
            ->name('api.v1.my.saves.index');

        Route::post('/places/{id}/save', [PlaceEngagementController::class, 'save'])
            ->whereNumber('id')->middleware('throttle:60,1')
            ->name('api.v1.places.save.store');
        Route::delete('/places/{id}/save', [PlaceEngagementController::class, 'unsave'])
            ->whereNumber('id')->middleware('throttle:60,1')
            ->name('api.v1.places.save.destroy');
    });

    // 5. Public Polls & Voting API
    // Never exposes voter identifiers (voter_key, ip_hash, user_agent) or polls.user_id.
    Route::middleware('throttle:public-api')->group(function () {
        Route::get('/polls', [VotingDataController::class, 'index'])
            ->name('api.v1.polls.index');
        Route::get('/polls/{idOrSlug}', [VotingDataController::class, 'show'])
            ->name('api.v1.polls.show');
        Route::get('/polls/{idOrSlug}/candidates', [VotingDataController::class, 'candidates'])
            ->name('api.v1.polls.candidates.index');
        Route::get('/polls/{idOrSlug}/scores', [VotingDataController::class, 'scores'])
            ->name('api.v1.polls.scores.index');
        Route::get('/polls/{idOrSlug}/ballots', [VotingDataController::class, 'ballots'])
            ->name('api.v1.polls.ballots.index');
        Route::get('/polls/{idOrSlug}/leaderboard', [PollController::class, 'leaderboard'])
            ->name('api.v1.polls.leaderboard');
    });

    Route::middleware('throttle:voting')->group(function () {
        Route::post('/polls/{idOrSlug}/ballots', [PollController::class, 'submit'])
            ->name('api.v1.polls.ballots.store');
        Route::post('/polls/ballots', [PollController::class, 'submit']);
    });

    // 6. Contributors, Population Atlas, Widgets & Utilities (versioned under /api/v1/*)
    Route::middleware('throttle:60,1')->group(function () {
        Route::get('/contributors', [ContributorController::class, 'index'])
            ->name('api.v1.contributors.index');
        Route::get('/contributors/{contributor}', [ContributorController::class, 'show'])
            ->name('api.v1.contributors.show');

        Route::get('/atlas', [PopulationAtlasController::class, 'index'])
            ->name('api.v1.atlas.index');
        Route::get('/atlas/environment', [PopulationAtlasController::class, 'environment'])
            ->name('api.v1.atlas.environment');
        Route::get('/population/master', [PopulationAtlasController::class, 'getData']);
        Route::get('/population/env-report', [PopulationAtlasController::class, 'getEnvironmentalDetails']);

        Route::get('/weather', [WeatherController::class, 'show'])
            ->name('api.v1.weather.show');
        Route::get('/answers', [AnswersController::class, 'index'])
            ->name('api.v1.answers.index');
        Route::get('/recipes/today', [RecipeController::class, 'ofTheDay'])
            ->name('api.v1.recipes.today');
        Route::get('/recipe-of-the-day', [RecipeController::class, 'ofTheDay']);
        Route::get('/events/today', [EventsController::class, 'today'])
            ->name('api.v1.events.today');
        Route::get('/feed', [FeedController::class, 'show'])
            ->name('api.v1.feed.show');
        Route::get('/prayer-times', [PrayerController::class, 'show'])
            ->name('api.v1.prayer-times.show');
        Route::get('/app-icon', [AppIconController::class, 'show'])
            ->name('api.v1.app-icon.show');
    });

    Route::get('/metrics', [MetricsController::class, 'index'])
        ->middleware('throttle:10,1')
        ->name('api.v1.metrics.index');
});

/*
|--------------------------------------------------------------------------
| Legacy Unversioned API Aliases (/api/*)
|--------------------------------------------------------------------------
| Kept for backwards compatibility with existing web and mobile consumers.
*/

Route::get('/polls', [PollController::class, 'index']);
Route::get('/polls/{idOrSlug}', [PollController::class, 'show']);
Route::get('/polls/{idOrSlug}/leaderboard', [PollController::class, 'leaderboard']);

Route::middleware('throttle:voting')->group(function () {
    Route::post('/submit', [PollController::class, 'submit']);
});

Route::get('/contributors', [ContributorController::class, 'index'])->middleware('throttle:60,1');
Route::get('/contributors/{contributor}', [ContributorController::class, 'show'])->middleware('throttle:60,1');

Route::get('/population/master', [PopulationAtlasController::class, 'getData'])->middleware('throttle:60,1');
Route::get('/population/env-report', [PopulationAtlasController::class, 'getEnvironmentalDetails'])->middleware('throttle:60,1');

Route::get('/weather', [WeatherController::class, 'show'])->middleware('throttle:60,1');
Route::get('/answers', [AnswersController::class, 'index'])->middleware('throttle:60,1');
Route::get('/recipe-of-the-day', [RecipeController::class, 'ofTheDay'])->middleware('throttle:60,1');
Route::get('/events/today', [EventsController::class, 'today'])->middleware('throttle:60,1');
Route::get('/feed', [FeedController::class, 'show'])->middleware('throttle:60,1');
Route::get('/prayer-times', [PrayerController::class, 'show'])->middleware('throttle:60,1');
Route::get('/metrics', [MetricsController::class, 'index'])->middleware('throttle:10,1');
Route::get('/app-icon', [AppIconController::class, 'show'])->middleware('throttle:60,1');
