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
use App\Http\Controllers\PlaceReportController;
use App\Http\Controllers\PollController;
use App\Http\Controllers\PrayerController;
use App\Http\Controllers\PromiseController;
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
| Shared Definitions
|--------------------------------------------------------------------------
| Modules served under more than one prefix are defined once below and
| mounted at every prefix they answer on, so an endpoint, a throttle or a
| capability cannot land on one URL and not its twin.
*/

// Ballot submission answers on /api/v1/polls/{idOrSlug}/ballots, the
// versioned alias /api/v1/polls/ballots and the older /api/submit. Only the
// first is named.
$pollBallotRoutes = function (string $path, ?string $name): void {
    Route::post($path, [PollController::class, 'submit'])->name($name);
};

// The public poll leaderboard answers on the versioned path (throttled by its
// mount) and on the older unthrottled /api path.
$pollLeaderboardRoutes = function (?string $name): void {
    Route::get('/polls/{idOrSlug}/leaderboard', [PollController::class, 'leaderboard'])->name($name);
};

// Public read-only widgets answer on /api/v1/* and on the older /api/* paths.
// The versioned mount owns the route names, and /recipes/today is
// versioned-only.
$publicWidgetRoutes = function (?string $namePrefix): void {
    $name = fn (string $suffix): ?string => $namePrefix === null ? null : $namePrefix.$suffix;

    Route::middleware('throttle:60,1')->group(function () use ($name, $namePrefix) {
        Route::get('/contributors', [ContributorController::class, 'index'])->name($name('contributors.index'));
        Route::get('/contributors/{contributor}', [ContributorController::class, 'show'])->name($name('contributors.show'));
        Route::get('/population/master', [PopulationAtlasController::class, 'getData']);
        Route::get('/population/env-report', [PopulationAtlasController::class, 'getEnvironmentalDetails']);
        Route::get('/weather', [WeatherController::class, 'show'])->name($name('weather.show'));
        Route::get('/answers', [AnswersController::class, 'index'])->name($name('answers.index'));
        if ($namePrefix !== null) {
            Route::get('/recipes/today', [RecipeController::class, 'ofTheDay'])->name($name('recipes.today'));
        }
        Route::get('/recipe-of-the-day', [RecipeController::class, 'ofTheDay']);
        Route::get('/events/today', [EventsController::class, 'today'])->name($name('events.today'));
        Route::get('/feed', [FeedController::class, 'show'])->name($name('feed.show'));
        Route::get('/prayer-times', [PrayerController::class, 'show'])->name($name('prayer-times.show'));
        Route::get('/app-icon', [AppIconController::class, 'show'])->name($name('app-icon.show'));
    });

    Route::get('/metrics', [MetricsController::class, 'index'])
        ->middleware('throttle:10,1')
        ->name($name('metrics.index'));
};

/*
|--------------------------------------------------------------------------
| Canonical Versioned API Routes (/api/v1/*)
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () use ($pollBallotRoutes, $pollLeaderboardRoutes, $publicWidgetRoutes) {
    // 0. Cross-Platform Authentication, Account, User Preferences & Dynamic Navigation Catalog
    Route::prefix('auth')->group(function () {
        // The token endpoint answers on the canonical path and on the older
        // /google alias; one definition, only the canonical one is named.
        $googleTokenRoutes = function (string $path, ?string $name): void {
            Route::post($path, [AuthController::class, 'googleToken'])
                ->middleware('throttle:20,1')
                ->name($name);
        };

        $googleTokenRoutes('/google/token', 'api.v1.auth.google.token');
        $googleTokenRoutes('/google', null);
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

    // 1. Cross-module global search. One definition, mounted on the canonical
    // path (named) and on the older /global-search alias.
    $globalSearchRoutes = function (string $path, ?string $name): void {
        Route::get($path, [GlobalSearchController::class, 'search'])->name($name);
    };

    Route::middleware('throttle:60,1')->group(function () use ($globalSearchRoutes) {
        $globalSearchRoutes('/search/global', 'api.v1.search.global');
        $globalSearchRoutes('/global-search', null);
    });

    // 2. Transit API. One definition of the public reads, mounted under the
    // canonical /api/v1/transit prefix and at the root of /api/v1. The
    // canonical mount keeps the pass-through actions, owns the route names and
    // adds the /map alias; the older aliases call the get* methods and use
    // /geo/poi.
    $transitPublicRoutes = function (bool $canonical): void {
        $name = fn (string $suffix): ?string => $canonical ? 'api.v1.transit.'.$suffix : null;

        Route::middleware('throttle:60,1')->group(function () use ($canonical, $name) {
            Route::get('/cities', [TransitController::class, $canonical ? 'cities' : 'getCities'])
                ->name($name('cities.index'));
            Route::get('/cities/{id}/routes', [TransitController::class, $canonical ? 'routes' : 'getRoutes'])
                ->name($name('cities.routes.index'));
            Route::get('/cities/{id}/map-data', [TransitController::class, $canonical ? 'mapData' : 'getMapData'])
                ->name($name('cities.map-data'));
            if ($canonical) {
                Route::get('/cities/{id}/map', [TransitController::class, 'mapData'])
                    ->name($name('cities.map'));
            }
            Route::get('/stops/nearby', [TransitController::class, $canonical ? 'nearbyStops' : 'getNearbyStops'])
                ->name($name('stops.nearby'));
            Route::get('/search', [TransitController::class, 'search'])
                ->name($name('search'));
            // POI search (mosques, cafes…) for the transit map: Photon first,
            // Google Places fallback on thin results. Static path, no conflicts.
            Route::get($canonical ? '/pois' : '/geo/poi', [PoiSearchController::class, 'search'])
                ->name($name('pois.index'));
        });
    };

    // Transit Studio. One definition, mounted under /api/v1/transit/studio/*
    // (canonical, named, with the PATCH alias) and the older /api/v1/studio/*
    // (unnamed, PUT only).
    $transitStudioRoutes = function (?string $namePrefix, bool $withPatchAlias): void {
        $name = fn (string $suffix): ?string => $namePrefix === null ? null : $namePrefix.$suffix;

        // Transit Studio is open for community contributions (supports optional
        // session or Bearer token).
        Route::post('/studio/routes', [TransitStudioController::class, 'store'])
            ->middleware('throttle:studio-submit')
            ->name($name('studio.routes.store'));

        // Authenticated iterative editing (admin geometry fixes, owner
        // resubmits): 10/min blocks legitimate rapid saving, so the studio
        // allows the same coarse rate as the other authed read/write endpoints.
        // The anonymous create stays at 5/min as the spam backstop.
        Route::middleware('auth:sanctum')->group(function () use ($name, $withPatchAlias) {
            Route::get('/studio/routes', [TransitStudioController::class, 'index'])
                ->middleware('throttle:60,1')
                ->name($name('studio.routes.index'));
            Route::get('/studio/routes/{id}', [TransitStudioController::class, 'show'])
                ->name($name('studio.routes.show'));
            Route::put('/studio/routes/{id}', [TransitStudioController::class, 'update'])
                ->middleware('throttle:60,1')
                ->name($name('studio.routes.update'));
            if ($withPatchAlias) {
                Route::patch('/studio/routes/{id}', [TransitStudioController::class, 'update'])
                    ->middleware('throttle:60,1');
            }
            Route::delete('/studio/routes/{id}', [TransitStudioController::class, 'destroy'])
                ->middleware('throttle:10,1')
                ->name($name('studio.routes.destroy'));
            Route::get('/studio/routes/{id}/from-route', [TransitStudioController::class, 'showForEdit'])
                ->name($name('studio.routes.from-route'));
        });
    };

    Route::prefix('transit')->group(function () use ($transitPublicRoutes, $transitStudioRoutes) {
        $transitPublicRoutes(true);
        $transitStudioRoutes('api.v1.transit.', true);
    });

    // The older aliases at the root of /api/v1.
    $transitPublicRoutes(false);
    $transitStudioRoutes(null, false);

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
        // One definition, mounted on the canonical /shares path (named) and the
        // older singular /share alias.
        $compassShareRoutes = function (string $path, bool $named): void {
            Route::post($path, [CompassShareController::class, 'store'])
                ->name($named ? 'api.v1.compass.shares.store' : null);
            Route::get($path.'/{shareId}', [CompassShareController::class, 'show'])
                ->name($named ? 'api.v1.compass.shares.show' : null);
        };

        Route::middleware('throttle:30,1')->group(function () use ($compassShareRoutes) {
            $compassShareRoutes('/shares', true);
            $compassShareRoutes('/share', false);

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
        // One report per user per place (unique index); the throttle only caps
        // a user flooding the moderation queue across many places.
        Route::post('/places/{id}/report', [PlaceReportController::class, 'store'])
            ->whereNumber('id')->middleware('throttle:10,60')
            ->name('api.v1.places.report.store');
    });

    // Promises tracker (عداد الوعود): visitor input. Suggestions and reports
    // need a signed-in account and land in the review queue; the "will it be
    // kept?" vote is open to guests and shares the tier-list `voting` limiter.
    Route::get('/promises/speakers', [PromiseController::class, 'speakers'])
        ->middleware('throttle:public-api')
        ->name('api.v1.promises.speakers');
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/promises', [PromiseController::class, 'storeSuggestion'])
            ->middleware('throttle:10,60')
            ->name('api.v1.promises.store');
        Route::post('/promises/{number}/reports', [PromiseController::class, 'storeReport'])
            ->where('number', '[0-9]{1,9}')->middleware('throttle:20,60')
            ->name('api.v1.promises.reports.store');
    });
    Route::post('/promises/{number}/vote', [PromiseController::class, 'vote'])
        ->where('number', '[0-9]{1,9}')->middleware('throttle:voting')
        ->name('api.v1.promises.vote');

    // 5. Public Polls & Voting API
    // Never exposes voter identifiers (voter_key, ip_hash, user_agent) or polls.user_id.
    Route::middleware('throttle:public-api')->group(function () use ($pollLeaderboardRoutes) {
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
        $pollLeaderboardRoutes('api.v1.polls.leaderboard');
    });

    Route::middleware('throttle:voting')->group(function () use ($pollBallotRoutes) {
        $pollBallotRoutes('/polls/{idOrSlug}/ballots', 'api.v1.polls.ballots.store');
        $pollBallotRoutes('/polls/ballots', null);
    });

    // 6. Contributors, Population Atlas, Widgets & Utilities (versioned under /api/v1/*)
    $publicWidgetRoutes('api.v1.');

    Route::middleware('throttle:60,1')->group(function () {
        Route::get('/atlas', [PopulationAtlasController::class, 'index'])
            ->name('api.v1.atlas.index');
        Route::get('/atlas/environment', [PopulationAtlasController::class, 'environment'])
            ->name('api.v1.atlas.environment');
    });
});

/*
|--------------------------------------------------------------------------
| Legacy Unversioned API Aliases (/api/*)
|--------------------------------------------------------------------------
| Kept for backwards compatibility with existing web and mobile consumers.
*/

Route::get('/polls', [PollController::class, 'index']);
Route::get('/polls/{idOrSlug}', [PollController::class, 'show']);
$pollLeaderboardRoutes(null);

Route::middleware('throttle:voting')->group(fn () => $pollBallotRoutes('/submit', null));

$publicWidgetRoutes(null);
