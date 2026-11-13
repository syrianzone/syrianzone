<?php

use App\Http\Controllers\AboutController;
use App\Http\Controllers\Api\PopulationAtlasController;
use App\Http\Controllers\ApiTokenAdminController;
use App\Http\Controllers\AssetUploadController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\CandidateController;
use App\Http\Controllers\CandidateGroupController;
use App\Http\Controllers\CompassAdminController;
use App\Http\Controllers\CompassController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DevController;
use App\Http\Controllers\ExternalDataController;
use App\Http\Controllers\GovAppController;
use App\Http\Controllers\GovAppsAdminController;
use App\Http\Controllers\GuessWhoAdminController;
use App\Http\Controllers\GuessWhoController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\PhonebookAdminController;
use App\Http\Controllers\LlmsTxtController;
use App\Http\Controllers\OgCardController;
use App\Http\Controllers\PhonebookController;
use App\Http\Controllers\PlaceAdminController;
use App\Http\Controllers\PlaceReportController;
use App\Http\Controllers\PlaceController;
use App\Http\Controllers\PollController;
use App\Http\Controllers\PromiseController;
use App\Http\Controllers\PromisesAdminController;
use App\Http\Controllers\RadioUsageController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\SiteNavigationAdminController;
use App\Http\Controllers\SitePopupAdminController;
use App\Http\Controllers\SyOfficialAdminController;
use App\Http\Controllers\SyOfficialController;
use App\Http\Controllers\TransitAdminController;
use App\Http\Controllers\TransitImportController;
use App\Http\Controllers\UserSettingsController;
use App\Models\City;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', [HomeController::class, 'index']);

Route::get('/healthcheck', function () {
    return response('OK', 200)->header('Content-Type', 'text/plain');
});

// Generated rather than shipped as a static file: polls and transit cities come
// from the database, so a checked-in sitemap.xml would drift the moment either
// changes. Cached for an hour inside the controller. Outside the web group for
// the same reason as the share cards below: a session cookie on the response
// stops Cloudflare from caching it.
Route::get('/sitemap.xml', [SitemapController::class, 'index'])
    ->withoutMiddleware('web');

// A Markdown index of the site for language-model tools (see Seo\LlmsTxt).
Route::get('/llms.txt', [LlmsTxtController::class, 'show'])
    ->withoutMiddleware('web');

// Share cards of single records, drawn on demand (see OgCardController). Kept
// out of the web group on purpose: a session cookie on the response would stop
// Cloudflare from caching the image.
Route::get('/og/r/{type}/{key}.{format}', [OgCardController::class, 'show'])
    ->where(['type' => '[a-z]+', 'key' => '[A-Za-z0-9_\-]+', 'format' => 'png|jpg'])
    ->withoutMiddleware('web')
    ->middleware('throttle:300,1');

Route::get('/syofficial', [SyOfficialController::class, 'index']);
Route::get('/polls', [PollController::class, 'renderIndex']);
Route::get('/polls/{slug}', [PollController::class, 'renderShow']);
Route::get('/polls/{slug}/leaderboard', [PollController::class, 'renderLeaderboard']);

Route::get('/tierlist', [PollController::class, 'renderTierList']);
Route::get('/tierlist/leaderboard', [PollController::class, 'renderTierListLeaderboard']);
Route::get('/compass', [CompassController::class, 'index']);
Route::get('/compass/stats', [CompassController::class, 'stats']);
Route::get('/compass/s/{shareId}', [CompassController::class, 'shared']);
// Promises tracker (عداد الوعود). Unknown or unpublished numbers 404.
Route::get('/promises', [PromiseController::class, 'index']);
Route::get('/promises/suggest', [PromiseController::class, 'suggest']);
Route::get('/promises/{number}', [PromiseController::class, 'show'])->where('number', '[0-9]{1,9}');
Route::get('/priorities', function () {
    return Inertia::render('Priorities/Index');
});
Route::get('/roznama', function () {
    return Inertia::render('Roznama/Index');
});
// Muslim Corner hub: one real route per tool, like the games hub. Each tool is
// a self-contained Inertia page under Pages/Muslim/. Legacy shared links that
// used the old ?tab= tabs land on the matching sub-page.
Route::get('/muslim', function () {
    $tab = request()->query('tab');
    if (in_array($tab, ['prayer', 'quran', 'radio'], true)) {
        return redirect("/muslim/{$tab}", 301);
    }

    return Inertia::render('Muslim/Index');
});
Route::get('/muslim/prayer', function () {
    return Inertia::render('Muslim/Prayer/Index');
});
Route::get('/muslim/quran', function () {
    return Inertia::render('Muslim/Quran/Index');
});
Route::get('/muslim/radio', function () {
    return Inertia::render('Muslim/Radio/Index');
});

// Games hub: one real route per game, like /muslim. Each game is a
// self-contained Inertia page under Pages/Games/, and every score is
// device-local — there is no games API and nothing to guard.
Route::get('/games', function () {
    return Inertia::render('Games/Index');
});
Route::get('/games/2048', function () {
    return Inertia::render('Games/2048/Index');
});
Route::get('/games/solitare', function () {
    return Inertia::render('Games/Solitare/Index');
});
Route::get('/games/tarneeb', function () {
    return Inertia::render('Games/Tarneeb/Index');
});
Route::get('/games/trix', function () {
    return Inertia::render('Games/Trix/Index');
});
Route::get('/phonebook', [PhonebookController::class, 'index']);
Route::get('/shawarma', function () {
    return Inertia::render('Shawarma/Index');
});
Route::get('/justice', function () {
    return Inertia::render('Justice/Index');
});
// Working hours ship with the page and the open/closed status is computed in the
// browser against Syria time, so there is nothing to query server-side here.
Route::get('/crossings', function () {
    return Inertia::render('Crossings/Index');
});
Route::get('/about', [AboutController::class, 'index']);
Route::get('/stats', function () {
    return Inertia::render('Stats');
});
Route::get('/privacy', function () {
    return Inertia::render('Privacy');
});
Route::get('/terms', function () {
    return Inertia::render('Terms');
});
Route::get('/syid', [ExternalDataController::class, 'syid']);
Route::get('/syrian-contributors', [ExternalDataController::class, 'contributors']);
Route::get('/sites', [ExternalDataController::class, 'sites']);
Route::get('/party', [ExternalDataController::class, 'party']);
Route::get('/house', [ExternalDataController::class, 'house']);
Route::get('/alignment', [ExternalDataController::class, 'alignment']);
Route::get('/govapps', [GovAppController::class, 'index']);
Route::get('/atlas', [PopulationAtlasController::class, 'renderIndex']);
Route::redirect('/population', '/atlas', 301);

// The music section (/syriafy, legacy /spotify) was removed. Soft-land any
// externally shared links on the homepage instead of returning a hard 404.
Route::redirect('/syriafy', '/', 301);
Route::redirect('/spotify', '/', 301);
Route::get('/syriafy/{any}', fn () => redirect('/', 301))->where('any', '.*');
Route::get('/spotify/{any}', fn () => redirect('/', 301))->where('any', '.*');

Route::get('/guesswho', [GuessWhoController::class, 'index']);
Route::get('/guesswho/room/{roomCode}', [GuessWhoController::class, 'showRoom']);

// Guess Who JSON endpoints: one definition, mounted under the canonical
// /api/v1/guesswho prefix (which owns the route names) and the older /guesswho
// paths. Only the per-room paths differ: the canonical tree says rooms/actions,
// the legacy one says room/action.
$guessWhoRoutes = function (string $room, string $action, ?string $namePrefix): void {
    $name = fn (string $suffix): ?string => $namePrefix === null ? null : $namePrefix.$suffix;

    Route::post('/rooms', [GuessWhoController::class, 'createRoom'])
        ->middleware('throttle:10,1')
        ->name($name('rooms.store'));
    Route::post("/{$room}/{roomCode}/join", [GuessWhoController::class, 'joinRoom'])
        ->middleware('throttle:30,1')
        ->name($name('rooms.join'));
    // The game's own moves go over Reverb.
    Route::post("/{$room}/{roomCode}/{$action}", [GuessWhoController::class, 'action'])
        ->middleware('throttle:120,1')
        ->name($name('rooms.actions.store'));
    Route::get("/{$room}/{roomCode}/state", [GuessWhoController::class, 'state'])
        ->middleware('throttle:60,1')
        ->name($name('rooms.state'));
    Route::post('/broadcasting/auth', [GuessWhoController::class, 'authenticateBroadcasting'])
        ->middleware('throttle:30,1')
        ->name($name('broadcasting.auth'));
};

Route::prefix('api/v1/guesswho')->group(fn () => $guessWhoRoutes('rooms', 'actions', 'api.v1.guesswho.'));
Route::prefix('guesswho')->group(fn () => $guessWhoRoutes('room', 'action', null));

Route::get('/transit', function () {
    return Inertia::render('Transit/Index', [
        'cities' => app(\App\Services\Transit\TransitCities::class)->forPage(),
    ]);
});

Route::get('/transit/city/{id}', function ($id) {
    $city = City::find($id);
    abort_unless($city !== null, 404);
    \App\Support\Seo\SeoMeta::remember(request(), 'city', $city);

    // The city list, the city's own payload and its route list travel with the
    // page, so the first HTML names the city and its lines instead of an empty
    // state that fills in after a fetch. All three come from the cached list the
    // API serves, not from a checked-in copy of the cities table.
    $cities = app(\App\Services\Transit\TransitCities::class)->forPage();

    return Inertia::render('Transit/city/[id]/Index', [
        'id' => $id,
        'cities' => $cities,
        'city' => collect($cities)->firstWhere('id', $id),
        'routes' => app(\App\Services\Transit\PublishedRoutes::class)->forCity($id),
    ]);
})->where('id', '[a-z0-9\-]+');

Route::get('/transit/city/{id}/map', function ($id) {
    return redirect("/transit/city/{$id}".(request()->getQueryString() ? '?'.request()->getQueryString() : ''), 301);
})->where('id', '[a-z0-9\-]+');

Route::get('/transit/city/{id}/route/{routeId}', function ($id, $routeId) {
    return redirect("/transit/city/{$id}?route={$routeId}", 301);
})->where(['id' => '[a-z0-9\-]+', 'routeId' => '[a-z0-9\-]+']);

Route::get('/transit/studio', function () {
    return Inertia::render('Transit/studio/Index', [
        'cities' => app(\App\Services\Transit\TransitCities::class)->forPage(),
    ]);
});

Route::get('/mishwar', [PlaceController::class, 'renderIndex']);
// legacy slug: share links from the first release said /places
Route::get('/places', fn () => redirect('/mishwar'.(request()->getQueryString() ? '?'.request()->getQueryString() : ''), 301));

// The board page is public: guests get a fully customizable board backed by
// localStorage, and only the sync endpoints below require auth.
Route::get('/board', [BoardController::class, 'renderIndex']);

Route::get('/user', [AuthController::class, 'user']);
Route::get('/auth/google', [AuthController::class, 'redirectToProvider'])->name('login');
Route::get('/auth/google/callback', [AuthController::class, 'handleProviderCallback']);
Route::post('/logout', [AuthController::class, 'logout']);
Route::get('/dev/impersonate/{role}', [DevController::class, 'impersonate'])->name('dev.impersonate');

Route::middleware('auth:web,sanctum')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::post('/api/account/update', [DashboardController::class, 'updateAccount']);
    Route::post('/api/account/avatar', [DashboardController::class, 'updateAvatar'])->middleware('throttle:10,1');
    Route::post('/api/account/delete', [DashboardController::class, 'deleteAccount']);

    Route::prefix('api')->group(function () {
        Route::get('/user', [AuthController::class, 'user']);
    });

    Route::middleware(['auth:web,sanctum', 'superadmin'])->group(function () {
        // Revoking every token of a user is superadmin-only: it also ends that
        // user's mobile sessions, so it is a leak response, not self-service.
        // The page, minting and single revocation are in the agent_tokens
        // group below.
        Route::delete('/api/v1/admin/users/{userId}/api-tokens', [ApiTokenAdminController::class, 'revokeAllForUser'])
            ->whereNumber('userId')
            ->middleware('agent_tokens')
            ->name('api.v1.admin.users.api-tokens.destroy-all');
        Route::post('/api/v1/admin/api-tokens/revoke-all/{userId}', [ApiTokenAdminController::class, 'revokeAllForUser'])
            ->whereNumber('userId')
            ->middleware('agent_tokens');
    });

    // Hosted-file manager. `assets.manage` is granted to the superadmin role
    // through User::effectivePermissions(), so the audience is superadmins.
    Route::middleware('assets_admin')->group(function () {
        Route::get('/admin/assets', [AssetUploadController::class, 'index'])
            ->middleware('assets_admin:assets.manage');

        Route::prefix('api/v1/admin/assets')->group(function () {
            Route::get('/list', [AssetUploadController::class, 'list'])
                ->middleware('assets_admin:assets.manage');
            Route::post('/upload', [AssetUploadController::class, 'store'])
                ->middleware('assets_admin:assets.manage');
            Route::delete('/delete', [AssetUploadController::class, 'destroy'])
                ->middleware('assets_admin:assets.manage');
        });
    });

    // Site-wide settings: the homepage popup and the navigation/icon catalogue.
    Route::middleware('site_admin')->group(function () {
        Route::get('/admin/site-popup', [SitePopupAdminController::class, 'renderIndex'])
            ->middleware('site_admin:site.popup');
        Route::get('/api/v1/admin/site-popup', [SitePopupAdminController::class, 'show'])
            ->middleware('site_admin:site.popup')
            ->name('api.v1.admin.site-popup.show');
        Route::put('/api/v1/admin/site-popup', [SitePopupAdminController::class, 'update'])
            ->middleware('site_admin:site.popup')
            ->name('api.v1.admin.site-popup.update');

        Route::get('/admin/navigation', [SiteNavigationAdminController::class, 'renderIndex'])
            ->middleware('site_admin:site.navigation');
        Route::get('/api/v1/admin/navigation', [SiteNavigationAdminController::class, 'show'])
            ->middleware('site_admin:site.navigation')
            ->name('api.v1.admin.navigation.show');
        Route::put('/api/v1/admin/navigation', [SiteNavigationAdminController::class, 'update'])
            ->middleware('site_admin:site.navigation')
            ->name('api.v1.admin.navigation.update');
    });

    // Agent API tokens (see docs/modules/agent-mcp.md). Open to any account
    // holding a capability, for its own tokens only: a token is clamped to its
    // owner's live permissions, so it can never exceed them. Superadmins manage
    // everyone's. `agent_tokens` also refuses bearer-token callers, so an agent
    // cannot mint itself a wider token.
    Route::middleware(['auth:web,sanctum', 'agent_tokens'])->group(function () {
        Route::get('/admin/api-tokens', [ApiTokenAdminController::class, 'renderIndex']);
        Route::post('/api/v1/admin/api-tokens', [ApiTokenAdminController::class, 'store'])
            ->name('api.v1.admin.api-tokens.store');
        Route::delete('/api/v1/admin/api-tokens/{id}', [ApiTokenAdminController::class, 'destroy'])
            ->whereNumber('id')
            ->name('api.v1.admin.api-tokens.destroy');
    });

    // Polls and general admin panel (core admins and superadmins). Poll
    // management lives in the unified user dashboard (/dashboard polls tab).
    // The legacy /admin/polls/* pages were removed to avoid a duplicate editor;
    // keep redirects so old bookmarks/links land on the dashboard editor.
    Route::redirect('/admin/polls', '/dashboard', 301);
    Route::redirect('/admin/polls/create', '/dashboard?create-poll=1', 301);
    Route::redirect('/admin/polls/{id}/edit', '/dashboard?edit-poll={id}', 301);
    Route::middleware('polls_admin')->group(function () {
        // Polls, candidate groups and candidates are one editable surface. The
        // dashboard editor calls the unversioned /api/* paths, so this is the
        // only mount.
        Route::prefix('api')->group(function () {
            Route::post('/polls', [PollController::class, 'store'])
                ->middleware('polls_admin:polls.create');
            Route::put('/polls/{id}', [PollController::class, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::delete('/polls/{id}', [PollController::class, 'destroy'])
                ->middleware('polls_admin:polls.delete');

            // Candidates and candidate groups are the editable content of a
            // poll. Creating them is part of building a poll, so it takes
            // polls.create; changing them takes polls.edit; removing them takes
            // polls.delete. That is what makes polls.create sufficient to
            // assemble a poll and no more.
            //
            // These are spelled out rather than declared with apiResource
            // because apiResource attaches one middleware string to the whole
            // resource, and `any` here would let a create-only user delete.
            // Read-only, and tagged `any` to keep the previous breadth: any
            // single polls capability could read these before, and reads are
            // not the risk writes are. Only mutating actions are separated.
            Route::get('/candidate-groups', [CandidateGroupController::class, 'index'])
                ->middleware('polls_admin:any');
            Route::get('/candidate-groups/{id}', [CandidateGroupController::class, 'show'])
                ->middleware('polls_admin:any');
            Route::post('/candidate-groups', [CandidateGroupController::class, 'store'])
                ->middleware('polls_admin:polls.create');
            Route::put('/candidate-groups/{id}', [CandidateGroupController::class, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::patch('/candidate-groups/{id}', [CandidateGroupController::class, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::delete('/candidate-groups/{id}', [CandidateGroupController::class, 'destroy'])
                ->middleware('polls_admin:polls.delete');
            Route::post('/candidate-groups/reorder', [CandidateGroupController::class, 'reorder'])
                ->middleware('polls_admin:polls.edit');
            Route::post('/candidate-groups/{id}/default', [CandidateGroupController::class, 'setDefault'])
                ->middleware('polls_admin:polls.edit');

            Route::post('/candidates', [CandidateController::class, 'store'])
                ->middleware('polls_admin:polls.create');
            Route::put('/candidates/{id}', [CandidateController::class, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::patch('/candidates/{id}', [CandidateController::class, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::delete('/candidates/{id}', [CandidateController::class, 'destroy'])
                ->middleware('polls_admin:polls.delete');
            Route::patch('/candidates/{id}/archive', [CandidateController::class, 'archive'])
                ->middleware('polls_admin:polls.edit');
            Route::patch('/candidates/{id}/restore', [CandidateController::class, 'restore'])
                ->middleware('polls_admin:polls.edit');
        });
    });

    // Guess Who content management, gated on `guesswho.manage`, which only the
    // superadmin role holds by default (User::effectivePermissions() resolves
    // the whole catalogue).
    Route::middleware('guesswho_admin')->group(function () {
        Route::get('/admin/guesswho', [GuessWhoAdminController::class, 'renderIndex'])
            ->middleware('guesswho_admin:guesswho.manage');

        Route::prefix('api/v1/admin/guesswho')->group(function () {
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
        Route::get('/admin/places', [PlaceAdminController::class, 'renderIndex'])
            ->middleware('places_admin:any');

        Route::prefix('api/v1')->middleware('throttle:60,1')->group(function () {
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

    // 3. Transit Admin Panel. The page shell needs any review capability;
    // mutating endpoints require the matching granular transit.* permission.
    // The shell is tagged `any` explicitly because the guard denies an untagged
    // route rather than granting the whole module.
    Route::middleware('transit_admin')->group(function () {
        Route::get('/transit/admin', function () {
            return Inertia::render('Transit/admin/Index');
        })->middleware('transit_admin:any');

        // Transit admin API. The dashboard and the studio call the
        // /api/v1/admin/* paths, so that is the only mount.
        Route::prefix('api/v1/admin')->group(function () {
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

    // Banning a user is a dashboard action, not a transit one: it is called from
    // resources/js/Pages/Dashboard/Index.tsx. It is authorised by the `users.ban`
    // capability rather than a role list, so it can be granted to one person
    // without granting it to everyone who shares a role.
    //
    // No throttle: picking a limit is an operator decision.
    Route::middleware('users_admin')->group(function () {
        Route::patch('/api/v1/admin/users/{id}/ban', [DashboardController::class, 'toggleBan'])
            ->middleware('users_admin:users.ban')
            ->name('api.v1.admin.users.ban');
        Route::post('/api/v1/admin/users/{id}/toggle-ban', [DashboardController::class, 'toggleBan'])
            ->middleware('users_admin:users.ban');
    });

    Route::middleware('syofficial_admin')->group(function () {
        Route::get('/admin/syofficial', [SyOfficialAdminController::class, 'renderIndex'])
            ->middleware('syofficial_admin:any');

        Route::prefix('api/v1/admin/syofficial')->group(function () {
            Route::post('/categories', [SyOfficialAdminController::class, 'storeCategory'])
                ->middleware('syofficial_admin:syofficial.create')
                ->name('api.v1.admin.syofficial.categories.store');
            Route::put('/categories/{id}', [SyOfficialAdminController::class, 'updateCategory'])
                ->middleware('syofficial_admin:syofficial.edit')
                ->name('api.v1.admin.syofficial.categories.update');
            // Cascades to every entity in the category, so it is gated on delete
            // alone and not on any of the other four.
            Route::delete('/categories/{id}', [SyOfficialAdminController::class, 'destroyCategory'])
                ->middleware('syofficial_admin:syofficial.delete')
                ->name('api.v1.admin.syofficial.categories.destroy');
            Route::post('/categories/reorder', [SyOfficialAdminController::class, 'reorderCategories'])
                ->middleware('syofficial_admin:syofficial.reorder')
                ->name('api.v1.admin.syofficial.categories.reorder');

            Route::post('/entities', [SyOfficialAdminController::class, 'storeEntity'])
                ->middleware('syofficial_admin:syofficial.create')
                ->name('api.v1.admin.syofficial.entities.store');
            Route::post('/entities/{id}', [SyOfficialAdminController::class, 'updateEntity'])
                ->middleware('syofficial_admin:syofficial.edit');
            Route::put('/entities/{id}', [SyOfficialAdminController::class, 'updateEntity'])
                ->middleware('syofficial_admin:syofficial.edit')
                ->name('api.v1.admin.syofficial.entities.update');
            Route::delete('/entities/{id}', [SyOfficialAdminController::class, 'destroyEntity'])
                ->middleware('syofficial_admin:syofficial.delete')
                ->name('api.v1.admin.syofficial.entities.destroy');
            Route::post('/entities/reorder', [SyOfficialAdminController::class, 'reorderEntities'])
                ->middleware('syofficial_admin:syofficial.reorder')
                ->name('api.v1.admin.syofficial.entities.reorder');
        });
    });

    Route::middleware('govapps_admin')->group(function () {
        Route::get('/admin/govapps', [GovAppsAdminController::class, 'renderIndex'])
            ->middleware('govapps_admin:any');

        Route::prefix('api/v1/admin/govapps')->group(function () {
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
        Route::get('/admin/phonebook', [PhonebookAdminController::class, 'renderIndex'])
            ->middleware('phonebook_admin:any');

        Route::prefix('api/v1/admin/phonebook')->group(function () {
            Route::post('/categories', [PhonebookAdminController::class, 'storeCategory'])
                ->middleware('phonebook_admin:phonebook.create')
                ->name('api.v1.admin.phonebook.categories.store');
            Route::put('/categories/{id}', [PhonebookAdminController::class, 'updateCategory'])
                ->middleware('phonebook_admin:phonebook.edit')
                ->name('api.v1.admin.phonebook.categories.update');
            Route::delete('/categories/{id}', [PhonebookAdminController::class, 'destroyCategory'])
                ->middleware('phonebook_admin:phonebook.delete')
                ->name('api.v1.admin.phonebook.categories.destroy');
            Route::post('/categories/reorder', [PhonebookAdminController::class, 'reorderCategories'])
                ->middleware('phonebook_admin:phonebook.reorder')
                ->name('api.v1.admin.phonebook.categories.reorder');

            Route::post('/entries', [PhonebookAdminController::class, 'storeEntry'])
                ->middleware('phonebook_admin:phonebook.create')
                ->name('api.v1.admin.phonebook.entries.store');
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
            Route::post('/entries/reorder', [PhonebookAdminController::class, 'reorderEntries'])
                ->middleware('phonebook_admin:phonebook.reorder')
                ->name('api.v1.admin.phonebook.entries.reorder');
        });
    });

    // 7. Compass Admin Panel: anonymised statistics + character roster.
    // Each route names its own capability; the read pages are not tagged `any`
    // so a future route has to declare what it needs.
    Route::middleware('compass_admin')->group(function () {
        Route::get('/admin/compass', [CompassAdminController::class, 'renderIndex'])
            ->middleware('compass_admin:compass.stats');
        Route::get('/admin/compass/figures', [CompassAdminController::class, 'renderFigures'])
            ->middleware('compass_admin:compass.figures');
        Route::get('/admin/compass/personas', [CompassAdminController::class, 'renderPersonas'])
            ->middleware('compass_admin:compass.personas');

        Route::prefix('api/v1/admin/compass/figures')
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

        Route::prefix('api/v1/admin/compass/personas')
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

    // 8. Promises Admin Panel (عداد الوعود): promises, review queue, speakers
    // and sectors. Every route names its capability; `any` is used only on
    // read-only page shells and the speaker search their pickers call.
    Route::middleware('promises_admin')->group(function () {
        Route::get('/admin/promises', [PromisesAdminController::class, 'renderIndex'])
            ->middleware('promises_admin:any');
        Route::get('/admin/promises/new', [PromisesAdminController::class, 'renderEditor'])
            ->middleware('promises_admin:promises.create');
        Route::get('/admin/promises/review', [PromisesAdminController::class, 'renderReview'])
            ->middleware('promises_admin:promises.review');
        Route::get('/admin/promises/speakers', [PromisesAdminController::class, 'renderSpeakers'])
            ->middleware('promises_admin:promises.speakers');
        Route::get('/admin/promises/sectors', [PromisesAdminController::class, 'renderSectors'])
            ->middleware('promises_admin:promises.speakers');
        // A read-only page shell: editors, rulers and reviewers all work from
        // it, and every control on it is gated by its own capability.
        Route::get('/admin/promises/{id}/edit', [PromisesAdminController::class, 'renderEditor'])
            ->whereUuid('id')
            ->middleware('promises_admin:any');
        // Rescheduling answers on the page path and on the API path; the
        // action, its capability and the UUID constraint are written once here.
        $promisesRescheduleRoutes = function (string $name): void {
            Route::post('/{promise}/reschedule', [PromisesAdminController::class, 'reschedule'])
                ->whereUuid('promise')
                ->middleware('promises_admin:promises.rule')
                ->name($name);
        };

        Route::prefix('admin/promises')->group(fn () => $promisesRescheduleRoutes('admin.promises.reschedule'));

        Route::prefix('api/v1/admin/promises')->middleware('throttle:120,1')->group(function () use ($promisesRescheduleRoutes) {
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
});

Route::post('/api/user/settings', [UserSettingsController::class, 'update'])
    ->middleware('throttle:60,1');
Route::post('/api/user/radio-usage', [RadioUsageController::class, 'add'])
    ->middleware('throttle:60,1');
Route::post('/api/user/radio-usage/clear', [RadioUsageController::class, 'clear'])
    ->middleware('throttle:10,1');
