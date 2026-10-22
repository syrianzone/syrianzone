<?php

use App\Http\Controllers\AboutController;
use App\Http\Controllers\AdminUserController;
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
use App\Http\Controllers\ExternalDataController;
use App\Http\Controllers\GovAppController;
use App\Http\Controllers\GovAppsAdminController;
use App\Http\Controllers\GuessWhoAdminController;
use App\Http\Controllers\GuessWhoController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\PhonebookAdminController;
use App\Http\Controllers\PhonebookController;
use App\Http\Controllers\PlaceAdminController;
use App\Http\Controllers\PlaceController;
use App\Http\Controllers\PlaceEngagementController;
use App\Http\Controllers\PollController;
use App\Http\Controllers\QuranBookmarkController;
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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', [HomeController::class, 'index']);

Route::get('/healthcheck', function () {
    return response('OK', 200)->header('Content-Type', 'text/plain');
});

// Generated rather than shipped as a static file: polls and transit cities come
// from the database, so a checked-in sitemap.xml would drift the moment either
// changes. Cached for an hour inside the controller.
Route::get('/sitemap.xml', [SitemapController::class, 'index']);

Route::get('/syofficial', [SyOfficialController::class, 'index']);
Route::get('/polls', [PollController::class, 'renderIndex']);
Route::get('/polls/{slug}', [PollController::class, 'renderShow']);
Route::get('/polls/{slug}/leaderboard', [PollController::class, 'renderLeaderboard']);

Route::get('/tierlist', [PollController::class, 'renderTierList']);
Route::get('/tierlist/leaderboard', [PollController::class, 'renderTierListLeaderboard']);
Route::get('/compass', [CompassController::class, 'index']);
Route::get('/compass/stats', [CompassController::class, 'stats']);
Route::get('/compass/s/{shareId}', [CompassController::class, 'shared']);
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

// Canonical versioned Guess Who JSON endpoints (/api/v1/guesswho/*)
Route::prefix('api/v1/guesswho')->group(function () {
    Route::post('/rooms', [GuessWhoController::class, 'createRoom'])
        ->middleware('throttle:10,1')
        ->name('api.v1.guesswho.rooms.store');
    Route::post('/rooms/{roomCode}/join', [GuessWhoController::class, 'joinRoom'])
        ->middleware('throttle:30,1')
        ->name('api.v1.guesswho.rooms.join');
    Route::post('/rooms/{roomCode}/actions', [GuessWhoController::class, 'action'])
        ->middleware('throttle:120,1')
        ->name('api.v1.guesswho.rooms.actions.store');
    Route::get('/rooms/{roomCode}/state', [GuessWhoController::class, 'state'])
        ->middleware('throttle:60,1')
        ->name('api.v1.guesswho.rooms.state');
    Route::post('/broadcasting/auth', [GuessWhoController::class, 'authenticateBroadcasting'])
        ->middleware('throttle:30,1')
        ->name('api.v1.guesswho.broadcasting.auth');
});

// Legacy Guess Who JSON endpoints (/guesswho/*)
Route::post('/guesswho/rooms', [GuessWhoController::class, 'createRoom'])->middleware('throttle:10,1');
Route::post('/guesswho/room/{roomCode}/join', [GuessWhoController::class, 'joinRoom'])->middleware('throttle:30,1');
// The game's own moves go over Reverb; the WebRTC signaling path is gone.
Route::post('/guesswho/room/{roomCode}/action', [GuessWhoController::class, 'action'])->middleware('throttle:120,1');
Route::get('/guesswho/room/{roomCode}/state', [GuessWhoController::class, 'state'])->middleware('throttle:60,1');
Route::post('/guesswho/broadcasting/auth', [GuessWhoController::class, 'authenticateBroadcasting'])->middleware('throttle:30,1');

Route::get('/transit', function () {
    $cities = Cache::remember('transit:cities', 3600, function () {
        $citiesModel = City::select(
            'id', 'name_ar', 'name_en', 'zoom', 'status',
            DB::raw('ST_AsGeoJSON(center) as center_geojson'),
            DB::raw('ST_AsGeoJSON(bounds) as bounds_geojson')
        )->withCount(['routes as routeCount' => fn ($q) => $q->where('status', 'published')])->get();

        return $citiesModel->map(function ($city) {
            $centerJson = json_decode($city->center_geojson, true);
            $boundsJson = json_decode($city->bounds_geojson, true);

            $minLng = $boundsJson['coordinates'][0][0][0] ?? 0;
            $minLat = $boundsJson['coordinates'][0][0][1] ?? 0;
            $maxLng = $boundsJson['coordinates'][0][2][0] ?? 0;
            $maxLat = $boundsJson['coordinates'][0][2][1] ?? 0;

            return [
                'id' => $city->id,
                'nameAr' => $city->name_ar,
                'nameEn' => $city->name_en,
                'status' => $city->status,
                'zoom' => $city->zoom,
                'center' => $centerJson['coordinates'] ?? [0, 0],
                'bounds' => [
                    [$minLng, $minLat],
                    [$maxLng, $maxLat],
                ],
                'routeCount' => $city->routeCount,
            ];
        })->toArray();
    });

    return Inertia::render('Transit/Index', ['cities' => $cities]);
});

Route::get('/transit/city/{id}', function ($id) {
    abort_unless(City::whereKey($id)->exists(), 404);

    return Inertia::render('Transit/city/[id]/Index', ['id' => $id]);
})->where('id', '[a-z0-9\-]+');

Route::get('/transit/city/{id}/map', function ($id) {
    return redirect("/transit/city/{$id}".(request()->getQueryString() ? '?'.request()->getQueryString() : ''), 301);
})->where('id', '[a-z0-9\-]+');

Route::get('/transit/city/{id}/route/{routeId}', function ($id, $routeId) {
    return redirect("/transit/city/{$id}?route={$routeId}", 301);
})->where(['id' => '[a-z0-9\-]+', 'routeId' => '[a-z0-9\-]+']);

Route::get('/transit/studio', function () {
    return Inertia::render('Transit/studio/Index');
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

Route::middleware('auth:web,sanctum')->group(function () {
    // 1. Unified User Dashboard Views and Actions
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Canonical versioned account & profile routes (/api/v1/*)
    Route::prefix('api/v1')->group(function () {
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

    // Legacy unversioned account & user aliases (/api/*)
    Route::post('/api/account/update', [DashboardController::class, 'updateAccount']);
    Route::post('/api/account/avatar', [DashboardController::class, 'updateAvatar'])->middleware('throttle:10,1');
    Route::post('/api/account/delete', [DashboardController::class, 'deleteAccount']);

    Route::prefix('api')->group(function () {
        Route::get('/user', [AuthController::class, 'user']);

        Route::middleware('superadmin')->group(function () {
            Route::get('/admins', [AdminUserController::class, 'index']);
            Route::post('/admins', [AdminUserController::class, 'store']);
            Route::delete('/admins/{id}', [AdminUserController::class, 'destroy']);
        });
    });

    Route::middleware(['auth:web,sanctum', 'superadmin'])->group(function () {
        Route::get('/admin/assets', [AssetUploadController::class, 'index']);

        // Canonical RESTful superadmin routes (/api/v1/admin/*)
        Route::get('/api/v1/admin/admins', [AdminUserController::class, 'index'])
            ->name('api.v1.admin.admins.index');
        Route::post('/api/v1/admin/admins', [AdminUserController::class, 'store'])
            ->name('api.v1.admin.admins.store');
        Route::delete('/api/v1/admin/admins/{id}', [AdminUserController::class, 'destroy'])
            ->name('api.v1.admin.admins.destroy');

        Route::get('/api/v1/admin/assets', [AssetUploadController::class, 'list'])
            ->name('api.v1.admin.assets.index');
        Route::get('/api/v1/admin/assets/manifest', [AssetUploadController::class, 'manifest'])
            ->name('api.v1.admin.assets.manifest');
        Route::post('/api/v1/admin/assets', [AssetUploadController::class, 'store'])
            ->name('api.v1.admin.assets.store');
        Route::delete('/api/v1/admin/assets', [AssetUploadController::class, 'destroy'])
            ->name('api.v1.admin.assets.destroy');

        // Legacy RPC asset routes
        Route::get('/api/v1/admin/assets/list', [AssetUploadController::class, 'list']);
        Route::post('/api/v1/admin/assets/upload', [AssetUploadController::class, 'store']);
        Route::delete('/api/v1/admin/assets/delete', [AssetUploadController::class, 'destroy']);

        Route::get('/admin/site-popup', [SitePopupAdminController::class, 'renderIndex']);
        Route::get('/api/v1/admin/site-popup', [SitePopupAdminController::class, 'show'])
            ->name('api.v1.admin.site-popup.show');
        Route::put('/api/v1/admin/site-popup', [SitePopupAdminController::class, 'update'])
            ->name('api.v1.admin.site-popup.update');

        Route::get('/admin/navigation', [SiteNavigationAdminController::class, 'renderIndex']);
        Route::get('/api/v1/admin/navigation', [SiteNavigationAdminController::class, 'show'])
            ->name('api.v1.admin.navigation.show');
        Route::put('/api/v1/admin/navigation', [SiteNavigationAdminController::class, 'update'])
            ->name('api.v1.admin.navigation.update');

        // Agent API tokens (see docs/modules/agent-mcp.md). Superadmin-only:
        // minting a token grants capability to an automated client, so it is
        // not delegated to module admins the way the moderation panels are.
        Route::get('/admin/api-tokens', [ApiTokenAdminController::class, 'renderIndex']);
        Route::post('/api/v1/admin/api-tokens', [ApiTokenAdminController::class, 'store'])
            ->name('api.v1.admin.api-tokens.store');
        Route::delete('/api/v1/admin/api-tokens/{id}', [ApiTokenAdminController::class, 'destroy'])
            ->whereNumber('id')
            ->name('api.v1.admin.api-tokens.destroy');
        Route::delete('/api/v1/admin/users/{userId}/api-tokens', [ApiTokenAdminController::class, 'revokeAllForUser'])
            ->whereNumber('userId')
            ->name('api.v1.admin.users.api-tokens.destroy-all');
        Route::post('/api/v1/admin/api-tokens/revoke-all/{userId}', [ApiTokenAdminController::class, 'revokeAllForUser'])
            ->whereNumber('userId');
    });

    // Hidden Places: authenticated writes (session + CSRF or Sanctum Bearer token)
    Route::prefix('api/v1')->group(function () {
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

    // 2. Polls & General Admin Panel (accessible to core admins and superadmins)
    // Poll management lives in the unified user dashboard (/dashboard polls tab).
    // The legacy /admin/polls/* pages were removed to avoid a duplicate editor;
    // keep redirects so old bookmarks/links land on the dashboard editor.
    Route::redirect('/admin/polls', '/dashboard', 301);
    Route::redirect('/admin/polls/create', '/dashboard?create-poll=1', 301);
    Route::redirect('/admin/polls/{id}/edit', '/dashboard?edit-poll={id}', 301);
    Route::middleware('polls_admin')->group(function () {
        // Canonical versioned Polls Admin routes (/api/v1/admin/*)
        Route::prefix('api/v1/admin')->group(function () {
            Route::post('/polls', [PollController::class, 'store'])
                ->middleware('polls_admin:polls.create')
                ->name('api.v1.admin.polls.store');
            Route::put('/polls/{id}', [PollController::class, 'update'])
                ->middleware('polls_admin:polls.edit')
                ->name('api.v1.admin.polls.update');
            Route::patch('/polls/{id}', [PollController::class, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::delete('/polls/{id}', [PollController::class, 'destroy'])
                ->middleware('polls_admin:polls.delete')
                ->name('api.v1.admin.polls.destroy');

            Route::get('/candidate-groups', [CandidateGroupController::class, 'index'])
                ->middleware('polls_admin:any')
                ->name('api.v1.admin.candidate-groups.index');
            Route::get('/candidate-groups/{id}', [CandidateGroupController::class, 'show'])
                ->middleware('polls_admin:any')
                ->name('api.v1.admin.candidate-groups.show');
            Route::post('/candidate-groups', [CandidateGroupController::class, 'store'])
                ->middleware('polls_admin:polls.create')
                ->name('api.v1.admin.candidate-groups.store');
            Route::put('/candidate-groups/{id}', [CandidateGroupController::class, 'update'])
                ->middleware('polls_admin:polls.edit')
                ->name('api.v1.admin.candidate-groups.update');
            Route::patch('/candidate-groups/{id}', [CandidateGroupController::class, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::delete('/candidate-groups/{id}', [CandidateGroupController::class, 'destroy'])
                ->middleware('polls_admin:polls.delete')
                ->name('api.v1.admin.candidate-groups.destroy');
            Route::post('/candidate-groups/reorder', [CandidateGroupController::class, 'reorder'])
                ->middleware('polls_admin:polls.edit')
                ->name('api.v1.admin.candidate-groups.reorder');
            Route::post('/candidate-groups/{id}/default', [CandidateGroupController::class, 'setDefault'])
                ->middleware('polls_admin:polls.edit')
                ->name('api.v1.admin.candidate-groups.default');

            Route::post('/candidates', [CandidateController::class, 'store'])
                ->middleware('polls_admin:polls.create')
                ->name('api.v1.admin.candidates.store');
            Route::put('/candidates/{id}', [CandidateController::class, 'update'])
                ->middleware('polls_admin:polls.edit')
                ->name('api.v1.admin.candidates.update');
            Route::patch('/candidates/{id}', [CandidateController::class, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::delete('/candidates/{id}', [CandidateController::class, 'destroy'])
                ->middleware('polls_admin:polls.delete')
                ->name('api.v1.admin.candidates.destroy');
            Route::patch('/candidates/{id}/archive', [CandidateController::class, 'archive'])
                ->middleware('polls_admin:polls.edit')
                ->name('api.v1.admin.candidates.archive');
            Route::patch('/candidates/{id}/restore', [CandidateController::class, 'restore'])
                ->middleware('polls_admin:polls.edit')
                ->name('api.v1.admin.candidates.restore');
        });

        // Legacy unversioned Polls Admin routes (/api/*)
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

    // Guess Who content management (migrated from Filament).
    //
    // Superadmin only. This was `middleware('admin')`, and with the `admin` role
    // on its way out the choice was between minting a `guesswho.*` capability for
    // a novelty game with one operator, and narrowing to superadmin. Narrowing
    // was the decision, so this is the one place Phase C removes access rather
    // than re-expresses it: anyone who was operating Guess Who as `admin` needs
    // promoting to superadmin.
    Route::middleware('superadmin')->group(function () {
        Route::get('/admin/guesswho', [GuessWhoAdminController::class, 'renderIndex']);

        Route::prefix('api/v1/admin/guesswho')->group(function () {
            Route::post('/categories', [GuessWhoAdminController::class, 'storeCategory'])
                ->name('api.v1.admin.guesswho.categories.store');
            Route::post('/categories/{id}', [GuessWhoAdminController::class, 'updateCategory'])->whereNumber('id');
            Route::put('/categories/{id}', [GuessWhoAdminController::class, 'updateCategory'])
                ->whereNumber('id')
                ->name('api.v1.admin.guesswho.categories.update');
            Route::delete('/categories/{id}', [GuessWhoAdminController::class, 'destroyCategory'])
                ->whereNumber('id')
                ->name('api.v1.admin.guesswho.categories.destroy');

            Route::post('/characters', [GuessWhoAdminController::class, 'storeCharacter'])
                ->name('api.v1.admin.guesswho.characters.store');
            Route::post('/characters/{id}', [GuessWhoAdminController::class, 'updateCharacter'])->whereNumber('id');
            Route::put('/characters/{id}', [GuessWhoAdminController::class, 'updateCharacter'])
                ->whereNumber('id')
                ->name('api.v1.admin.guesswho.characters.update');
            Route::delete('/characters/{id}', [GuessWhoAdminController::class, 'destroyCharacter'])
                ->whereNumber('id')
                ->name('api.v1.admin.guesswho.characters.destroy');
        });
    });

    // 2b. Hidden Places moderation (core admins, superadmins, places.* holders)
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
        });
    });

    // 3. Transit Admin Panel. The page shell needs any review capability;
    // mutating endpoints require the matching granular transit.* permission.
    // Both group-level routes below are tagged `any` explicitly because the
    // guard denies an untagged route rather than granting the whole module.
    Route::middleware('transit_admin')->group(function () {
        Route::get('/transit/admin', function () {
            return Inertia::render('Transit/admin/Index');
        })->middleware('transit_admin:any');

        // Canonical Transit Admin routes under /api/v1/admin/transit/*
        Route::prefix('api/v1/admin/transit')->group(function () {
            Route::get('/route-drafts', [TransitAdminController::class, 'index'])
                ->middleware('transit_admin:transit.review_drafts')
                ->name('api.v1.admin.transit.route-drafts.index');
            Route::post('/route-drafts/{id}/approve', [TransitAdminController::class, 'approve'])
                ->middleware('transit_admin:transit.approve')
                ->name('api.v1.admin.transit.route-drafts.approve');
            Route::post('/route-drafts/{id}/reject', [TransitAdminController::class, 'reject'])
                ->middleware('transit_admin:transit.reject')
                ->name('api.v1.admin.transit.route-drafts.reject');

            Route::get('/routes', [TransitAdminController::class, 'getPublishedRoutes'])
                ->middleware('transit_admin:transit.review_drafts')
                ->name('api.v1.admin.transit.routes.index');
            Route::get('/routes/logs', [TransitAdminController::class, 'getLogs'])
                ->middleware('transit_admin:transit.review_drafts')
                ->name('api.v1.admin.transit.routes.logs');
            Route::get('/routes/{id}/geojson', [TransitAdminController::class, 'getRouteGeoJson'])
                ->middleware('transit_admin:transit.review_drafts')
                ->name('api.v1.admin.transit.routes.geojson');
            Route::patch('/routes/{id}/status', [TransitAdminController::class, 'updateRouteStatus'])
                ->middleware('transit_admin:transit.edit_routes')
                ->name('api.v1.admin.transit.routes.status.update');
            Route::post('/routes/{id}/status', [TransitAdminController::class, 'updateRouteStatus'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::put('/routes/{id}', [TransitAdminController::class, 'updateRoute'])
                ->middleware('transit_admin:transit.edit_routes')
                ->name('api.v1.admin.transit.routes.update');
            Route::delete('/routes/{id}', [TransitAdminController::class, 'destroy'])
                ->middleware('transit_admin:transit.delete_routes')
                ->name('api.v1.admin.transit.routes.destroy');
            Route::post('/routes/{id}/move', [TransitAdminController::class, 'moveRoute'])
                ->middleware('transit_admin:transit.edit_routes')
                ->name('api.v1.admin.transit.routes.move');
            Route::post('/routes/combine', [TransitAdminController::class, 'combineRoutes'])
                ->middleware('transit_admin:transit.edit_routes')
                ->name('api.v1.admin.transit.routes.combine');
            Route::post('/routes/split', [TransitAdminController::class, 'splitRoute'])
                ->middleware('transit_admin:transit.edit_routes')
                ->name('api.v1.admin.transit.routes.split');
            Route::get('/routes/{id}/stops', [TransitAdminController::class, 'getRouteStops'])
                ->middleware('transit_admin:transit.review_drafts')
                ->name('api.v1.admin.transit.routes.stops.index');
            Route::post('/routes/import-preview', [TransitImportController::class, 'preview'])
                ->middleware(['transit_admin:transit.review_drafts', 'throttle:30,1'])
                ->name('api.v1.admin.transit.routes.import-preview');
            Route::post('/routes/import-publish', [TransitImportController::class, 'publish'])
                ->middleware(['transit_admin:transit.edit_routes', 'throttle:30,1'])
                ->name('api.v1.admin.transit.routes.import-publish');
        });

        // Legacy Transit Admin routes under /api/v1/admin/*
        Route::prefix('api/v1')->group(function () {
            Route::get('/admin/route-drafts', [TransitAdminController::class, 'index'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::post('/admin/route-drafts/{id}/approve', [TransitAdminController::class, 'approve'])
                ->middleware('transit_admin:transit.approve');
            Route::post('/admin/route-drafts/{id}/reject', [TransitAdminController::class, 'reject'])
                ->middleware('transit_admin:transit.reject');

            Route::get('/admin/routes', [TransitAdminController::class, 'getPublishedRoutes'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::get('/admin/routes/logs', [TransitAdminController::class, 'getLogs'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::get('/admin/routes/{id}/geojson', [TransitAdminController::class, 'getRouteGeoJson'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::patch('/admin/routes/{id}/status', [TransitAdminController::class, 'updateRouteStatus'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/admin/routes/{id}/status', [TransitAdminController::class, 'updateRouteStatus'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::put('/admin/routes/{id}', [TransitAdminController::class, 'updateRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::delete('/admin/routes/{id}', [TransitAdminController::class, 'destroy'])
                ->middleware('transit_admin:transit.delete_routes');
            Route::post('/admin/routes/{id}/move', [TransitAdminController::class, 'moveRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/admin/routes/combine', [TransitAdminController::class, 'combineRoutes'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/admin/routes/split', [TransitAdminController::class, 'splitRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::get('/admin/routes/{id}/stops', [TransitAdminController::class, 'getRouteStops'])
                ->middleware('transit_admin:transit.review_drafts');
            // Preview responses are cached per-mid for an hour, so repeated
            // reviews are cheap: allow an admin-friendly rate instead of
            // blocking legitimate retry loops with 429s.
            Route::post('/admin/routes/import-preview', [TransitImportController::class, 'preview'])
                ->middleware(['transit_admin:transit.review_drafts', 'throttle:30,1']);
            Route::post('/admin/routes/import-publish', [TransitImportController::class, 'publish'])
                ->middleware(['transit_admin:transit.edit_routes', 'throttle:30,1']);
        });
    });

    // Banning a user is a dashboard action, not a transit one: it is called from
    // resources/js/Pages/Dashboard/Index.tsx. It used to be declared inside the
    // transit_admin group, which was both a misfiling and a hazard — that group
    // gates by transit capability, so a user holding only `transit.review_drafts`
    // reached a user-moderation endpoint, and saving it required the blanket
    // `any` tag that ModuleCapabilityRoutesTest rightly rejects on a mutating
    // route.
    //
    // It is authorised by the `users.ban` capability rather than the role list
    // the controller used to carry inline, so it can be granted to one person
    // without granting it to everyone who shares a role.
    //
    // No throttle added: this route had none before, and picking a limit is an
    // operator decision rather than a side effect of moving it.
    Route::middleware('users_admin')->group(function () {
        Route::patch('/api/v1/admin/users/{id}/ban', [DashboardController::class, 'toggleBan'])
            ->middleware('users_admin:users.ban')
            ->name('api.v1.admin.users.ban');
        Route::post('/api/v1/admin/users/{id}/toggle-ban', [DashboardController::class, 'toggleBan'])
            ->middleware('users_admin:users.ban');
    });

    // 4. SyOfficial Admin Panel (accessible to core admins, syofficial_admin, and superadmins)
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

            // Legacy reorder paths
            Route::post('/reorder/categories', [SyOfficialAdminController::class, 'reorderCategories'])
                ->middleware('syofficial_admin:syofficial.reorder');
            Route::post('/reorder/entities', [SyOfficialAdminController::class, 'reorderEntities'])
                ->middleware('syofficial_admin:syofficial.reorder');
        });
    });

    // 5. GovApps Admin Panel
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

    // 6. Phonebook Admin Panel
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

            // Legacy reorder paths
            Route::post('/reorder/categories', [PhonebookAdminController::class, 'reorderCategories'])
                ->middleware('phonebook_admin:phonebook.reorder');
            Route::post('/reorder/entries', [PhonebookAdminController::class, 'reorderEntries'])
                ->middleware('phonebook_admin:phonebook.reorder');
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
});

// User settings & Quran radio usage API endpoints (canonical /api/v1/* + legacy /api/*)
Route::prefix('api/v1/user')->group(function () {
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

// Legacy unversioned user settings & radio usage endpoints
Route::post('/api/user/settings', [UserSettingsController::class, 'update'])
    ->middleware('throttle:60,1');
Route::post('/api/user/radio-usage', [RadioUsageController::class, 'add'])
    ->middleware('throttle:60,1');
Route::post('/api/user/radio-usage/clear', [RadioUsageController::class, 'clear'])
    ->middleware('throttle:10,1');
