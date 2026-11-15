<?php

use App\Http\Controllers\AboutController;
use App\Http\Controllers\Api\PopulationAtlasController;
use App\Http\Controllers\ApiTokenAdminController;
use App\Http\Controllers\AssetUploadController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BoardController;
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
use App\Http\Controllers\UserSettingsController;
use App\Http\Middleware\FirstPartyAdminTransport;
use App\Models\City;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', [HomeController::class, 'index']);

// Caddy sends traffic only to an app container that answers 200 here.
// deploy.sh creates the draining flag in the outgoing container before it
// stops it, so Caddy moves traffic to the new release first and in-flight
// requests finish instead of being cut.
Route::get('/healthcheck', function () {
    if (file_exists(storage_path('framework/draining'))) {
        return response('draining', 503)->header('Content-Type', 'text/plain');
    }

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
$guessWhoRoutes = require __DIR__.'/guesswho.php';

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
Route::get('/auth/google', [AuthController::class, 'redirectToProvider'])->block(30, 5)->name('login');
Route::get('/auth/google/native', [AuthController::class, 'nativeGoogleStart'])->middleware('throttle:native-google-start')->block(30, 5);
Route::get('/auth/google/callback', [AuthController::class, 'handleProviderCallback'])->block(30, 5);
Route::post('/logout', [AuthController::class, 'logout']);
Route::get('/dev/impersonate/{role}', [DevController::class, 'impersonate'])->name('dev.impersonate');

Route::middleware('auth:web,sanctum')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->middleware(FirstPartyAdminTransport::class)->name('dashboard');

    Route::post('/api/account/update', [DashboardController::class, 'updateAccount']);
    Route::post('/api/account/avatar', [DashboardController::class, 'updateAvatar'])->middleware('throttle:10,1');
    Route::post('/api/account/delete', [DashboardController::class, 'deleteAccount']);

    Route::prefix('api')->group(function () {
        Route::get('/user', [AuthController::class, 'user']);
    });

    // Hosted-file manager. `assets.manage` is granted to the superadmin role
    // through User::effectivePermissions(), so the audience is superadmins.
    Route::middleware([FirstPartyAdminTransport::class, 'assets_admin'])->group(function () {
        Route::get('/admin/assets', [AssetUploadController::class, 'index'])
            ->middleware('assets_admin:assets.manage');
    });

    // Site-wide settings: the homepage popup and the navigation/icon catalogue.
    Route::middleware([FirstPartyAdminTransport::class, 'site_admin'])->group(function () {
        Route::get('/admin/site-popup', [SitePopupAdminController::class, 'renderIndex'])
            ->middleware('site_admin:site.popup');

        Route::get('/admin/navigation', [SiteNavigationAdminController::class, 'renderIndex'])
            ->middleware('site_admin:site.navigation');
    });

    // Agent API tokens (see docs/modules/agent-mcp.md). Open to any account
    // holding a capability, for its own tokens only: a token is clamped to its
    // owner's live permissions, so it can never exceed them. Superadmins manage
    // everyone's. `agent_tokens` also refuses bearer-token callers, so an agent
    // cannot mint itself a wider token.
    Route::middleware(['auth:web,sanctum', FirstPartyAdminTransport::class, 'agent_tokens'])->group(function () {
        Route::get('/admin/api-tokens', [ApiTokenAdminController::class, 'renderIndex']);
    });

    // Polls and general admin panel (core admins and superadmins). Poll
    // management lives in the unified user dashboard (/dashboard polls tab).
    // The legacy /admin/polls/* pages were removed to avoid a duplicate editor;
    // keep redirects so old bookmarks/links land on the dashboard editor.
    Route::redirect('/admin/polls', '/dashboard', 301);
    Route::redirect('/admin/polls/create', '/dashboard?create-poll=1', 301);
    Route::redirect('/admin/polls/{id}/edit', '/dashboard?edit-poll={id}', 301);
    Route::middleware([FirstPartyAdminTransport::class, 'polls_admin'])->group(function () {
        // Polls, candidate groups and candidates are one editable surface. The
        // Browser writes retain session and CSRF middleware on these aliases.
        Route::prefix('api')->group((require __DIR__.'/poll-management.php')(false));
    });

    // Guess Who content management, gated on `guesswho.manage`, which only the
    // superadmin role holds by default (User::effectivePermissions() resolves
    // the whole catalogue).
    Route::middleware([FirstPartyAdminTransport::class, 'guesswho_admin'])->group(function () {
        Route::get('/admin/guesswho', [GuessWhoAdminController::class, 'renderIndex'])
            ->middleware('guesswho_admin:guesswho.manage');
    });

    Route::middleware([FirstPartyAdminTransport::class, 'places_admin'])->group(function () {
        Route::get('/admin/places', [PlaceAdminController::class, 'renderIndex'])
            ->middleware('places_admin:any');
    });

    // 3. Transit Admin Panel. The page shell needs any review capability;
    // mutating endpoints require the matching granular transit.* permission.
    // The shell is tagged `any` explicitly because the guard denies an untagged
    // route rather than granting the whole module.
    Route::middleware([FirstPartyAdminTransport::class, 'transit_admin'])->group(function () {
        Route::get('/transit/admin', function () {
            return Inertia::render('Transit/admin/Index');
        })->middleware('transit_admin:any');

    });

    Route::middleware([FirstPartyAdminTransport::class, 'syofficial_admin'])->group(function () {
        Route::get('/admin/syofficial', [SyOfficialAdminController::class, 'renderIndex'])
            ->middleware('syofficial_admin:any');
    });

    Route::middleware([FirstPartyAdminTransport::class, 'govapps_admin'])->group(function () {
        Route::get('/admin/govapps', [GovAppsAdminController::class, 'renderIndex'])
            ->middleware('govapps_admin:any');
    });

    Route::middleware([FirstPartyAdminTransport::class, 'phonebook_admin'])->group(function () {
        Route::get('/admin/phonebook', [PhonebookAdminController::class, 'renderIndex'])
            ->middleware('phonebook_admin:any');
    });

    // 7. Compass Admin Panel: anonymised statistics + character roster.
    // Each route names its own capability; the read pages are not tagged `any`
    // so a future route has to declare what it needs.
    Route::middleware([FirstPartyAdminTransport::class, 'compass_admin'])->group(function () {
        Route::get('/admin/compass', [CompassAdminController::class, 'renderIndex'])
            ->middleware('compass_admin:compass.stats');
        Route::get('/admin/compass/figures', [CompassAdminController::class, 'renderFigures'])
            ->middleware('compass_admin:compass.figures');
        Route::get('/admin/compass/personas', [CompassAdminController::class, 'renderPersonas'])
            ->middleware('compass_admin:compass.personas');
    });

    // 8. Promises Admin Panel (عداد الوعود): promises, review queue, speakers
    // and sectors. Every route names its capability; `any` is used only on
    // read-only page shells and the speaker search their pickers call.
    Route::middleware([FirstPartyAdminTransport::class, 'promises_admin'])->group(function () {
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
        $promisesRescheduleRoutes = require __DIR__.'/promises-reschedule.php';

        Route::prefix('admin/promises')->group(fn () => $promisesRescheduleRoutes('admin.promises.reschedule'));
    });
});

Route::post('/api/user/settings', [UserSettingsController::class, 'update'])
    ->middleware(['api_user', 'throttle:60,1']);
Route::post('/api/user/radio-usage', [RadioUsageController::class, 'add'])
    ->middleware(['api_user', 'throttle:60,1']);
Route::post('/api/user/radio-usage/clear', [RadioUsageController::class, 'clear'])
    ->middleware(['api_user', 'throttle:10,1']);
