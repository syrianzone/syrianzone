<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\GuessWhoController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\SignalingController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', [HomeController::class, 'index']);

Route::get('/healthcheck', function () {
    return response('OK', 200)->header('Content-Type', 'text/plain');
});

// Generated rather than shipped as a static file: polls and transit cities come
// from the database, so a checked-in sitemap.xml would drift the moment either
// changes. Cached for an hour inside the controller.
Route::get('/sitemap.xml', [\App\Http\Controllers\SitemapController::class, 'index']);

use App\Http\Controllers\PollController;
use App\Http\Controllers\SyOfficialController;

Route::get('/syofficial', [SyOfficialController::class, 'index']);
Route::get('/polls', [PollController::class, 'renderIndex']);
Route::get('/polls/{slug}', [PollController::class, 'renderShow']);
Route::get('/polls/{slug}/leaderboard', [PollController::class, 'renderLeaderboard']);

Route::get('/tierlist', [PollController::class, 'renderTierList']);
use App\Http\Controllers\Api\PopulationAtlasController;
use App\Http\Controllers\ExternalDataController;

Route::get('/tierlist/leaderboard', [PollController::class, 'renderTierListLeaderboard']);
Route::get('/compass', function () {
    return Inertia::render('Compass/Index');
});
Route::get('/priorities', function () {
    return Inertia::render('Priorities/Index');
});
Route::get('/roznama', function () {
    return Inertia::render('Roznama/Index');
});
Route::get('/muslim', function () {
    return Inertia::render('Muslim/Index');
});
Route::get('/phonebook', [\App\Http\Controllers\PhonebookController::class, 'index']);
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
Route::get('/about', function () {
    return Inertia::render('About');
});
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
Route::get('/govapps', [\App\Http\Controllers\GovAppController::class, 'index']);
Route::get('/atlas', [PopulationAtlasController::class, 'renderIndex']);
Route::redirect('/population', '/atlas', 301);

// The music section (/syriafy, legacy /spotify) was removed. Soft-land any
// externally shared links on the homepage instead of returning a hard 404.
Route::redirect('/syriafy', '/', 301);
Route::redirect('/spotify', '/', 301);
Route::get('/syriafy/{any}', fn () => redirect('/', 301))->where('any', '.*');
Route::get('/spotify/{any}', fn () => redirect('/', 301))->where('any', '.*');

Route::get('/guesswho', [GuessWhoController::class, 'index']);
Route::post('/guesswho/rooms', [GuessWhoController::class, 'createRoom'])->middleware('throttle:10,1');
Route::get('/guesswho/room/{roomCode}', [GuessWhoController::class, 'showRoom']);
Route::post('/guesswho/room/{roomCode}/join', [GuessWhoController::class, 'joinRoom'])->middleware('throttle:30,1');
Route::post('/guesswho/room/{roomCode}/signal', [SignalingController::class, 'signal'])->middleware('throttle:60,1');
Route::post('/guesswho/broadcasting/auth', [GuessWhoController::class, 'authenticateBroadcasting'])->middleware('throttle:30,1');

Route::get('/transit', function () {
    $cities = \Illuminate\Support\Facades\Cache::remember('transit:cities', 3600, function () {
        $citiesModel = \App\Models\City::select(
            'id', 'name_ar', 'name_en', 'zoom', 'status',
            \Illuminate\Support\Facades\DB::raw('ST_AsGeoJSON(center) as center_geojson'),
            \Illuminate\Support\Facades\DB::raw('ST_AsGeoJSON(bounds) as bounds_geojson')
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

Route::get('/mishwar', [\App\Http\Controllers\PlaceController::class, 'renderIndex']);
// legacy slug: share links from the first release said /places
Route::get('/places', fn () => redirect('/mishwar'.(request()->getQueryString() ? '?'.request()->getQueryString() : ''), 301));

// The board page is public: guests get a fully customizable board backed by
// localStorage, and only the sync endpoints below require auth.
Route::get('/board', [\App\Http\Controllers\BoardController::class, 'renderIndex']);

Route::get('/user', [AuthController::class, 'user']);
Route::get('/auth/google', [AuthController::class, 'redirectToProvider'])->name('login');
Route::get('/auth/google/callback', [AuthController::class, 'handleProviderCallback']);
Route::post('/logout', [AuthController::class, 'logout']);

use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\DashboardController;

Route::middleware('auth')->group(function () {
    // 1. Unified User Dashboard Views and Actions
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::post('/api/account/update', [DashboardController::class, 'updateAccount']);
    Route::post('/api/account/avatar', [DashboardController::class, 'updateAvatar'])->middleware('throttle:10,1');
    Route::post('/api/account/delete', [DashboardController::class, 'deleteAccount']);

    // Board layout sync. Session + CSRF, so it lives here rather than api.php.
    Route::get('/api/v1/board', [\App\Http\Controllers\BoardController::class, 'show'])
        ->middleware('throttle:60,1');
    Route::put('/api/v1/board', [\App\Http\Controllers\BoardController::class, 'update'])
        ->middleware('throttle:60,1');

    // Quran Ayah bookmarks (logged-in only). Session + CSRF like board sync.
    Route::get('/api/v1/quran-bookmarks', [\App\Http\Controllers\QuranBookmarkController::class, 'index'])
        ->middleware('throttle:60,1');
    Route::post('/api/v1/quran-bookmarks', [\App\Http\Controllers\QuranBookmarkController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::delete('/api/v1/quran-bookmarks/{surah}/{ayah}', [\App\Http\Controllers\QuranBookmarkController::class, 'destroy'])
        ->whereNumber('surah')->whereNumber('ayah')->middleware('throttle:60,1');

    Route::prefix('api')->group(function () {
        // Shares one definition with the Inertia payload so /user and the
        // initial page load can never disagree about the user's capabilities.
        Route::get('/user', function (\Illuminate\Http\Request $request) {
            return \App\Http\Middleware\HandleInertiaRequests::userPayload($request->user());
        });

        Route::middleware('superadmin')->group(function () {
            Route::get('/admins', [AdminUserController::class, 'index']);
            Route::post('/admins', [AdminUserController::class, 'store']);
            Route::delete('/admins/{id}', [AdminUserController::class, 'destroy']);
        });
    });

    Route::middleware(['auth', 'superadmin'])->group(function () {
        Route::get('/admin/assets', [\App\Http\Controllers\AssetUploadController::class, 'index']);
        Route::get('/api/v1/admin/assets/list', [\App\Http\Controllers\AssetUploadController::class, 'list']);
        Route::get('/api/v1/admin/assets/manifest', [\App\Http\Controllers\AssetUploadController::class, 'manifest']);
        Route::post('/api/v1/admin/assets/upload', [\App\Http\Controllers\AssetUploadController::class, 'store']);
        Route::delete('/api/v1/admin/assets/delete', [\App\Http\Controllers\AssetUploadController::class, 'destroy']);
        Route::get('/admin/site-popup', [\App\Http\Controllers\SitePopupAdminController::class, 'renderIndex']);
        Route::get('/api/v1/admin/site-popup', [\App\Http\Controllers\SitePopupAdminController::class, 'show']);
        Route::put('/api/v1/admin/site-popup', [\App\Http\Controllers\SitePopupAdminController::class, 'update']);

        // Agent API tokens (see docs/modules/agent-mcp.md). Superadmin-only:
        // minting a token grants capability to an automated client, so it is
        // not delegated to module admins the way the moderation panels are.
        Route::get('/admin/api-tokens', [\App\Http\Controllers\ApiTokenAdminController::class, 'renderIndex']);
        Route::post('/api/v1/admin/api-tokens', [\App\Http\Controllers\ApiTokenAdminController::class, 'store']);
        Route::delete('/api/v1/admin/api-tokens/{id}', [\App\Http\Controllers\ApiTokenAdminController::class, 'destroy'])->whereNumber('id');
        Route::post('/api/v1/admin/api-tokens/revoke-all/{userId}', [\App\Http\Controllers\ApiTokenAdminController::class, 'revokeAllForUser'])->whereNumber('userId');
    });

    // Hidden Places: authenticated writes (session + CSRF via the web group)
    Route::prefix('api/v1')->group(function () {
        // No per-user submission cap: moderation gates everything to the public map,
        // so this throttle is only a flood backstop no normal use touches.
        Route::post('/places', [\App\Http\Controllers\PlaceController::class, 'store'])
            ->middleware('throttle:60,1');
        Route::get('/my/places', [\App\Http\Controllers\PlaceController::class, 'mine'])
            ->middleware('throttle:60,1');
        // Every accepted move re-enters the moderation queue, so mirror the
        // store() coarse shield instead of a per-minute rate.
        Route::patch('/my/places/{id}/location', [\App\Http\Controllers\PlaceController::class, 'updateLocation'])
            ->whereNumber('id')->middleware('throttle:20,60');
        // Owner mutations share the same coarse hourly shield: every accepted
        // content change re-enters the moderation queue.
        Route::patch('/my/places/{id}', [\App\Http\Controllers\PlaceController::class, 'updateDetails'])
            ->whereNumber('id')->middleware('throttle:20,60');
        Route::post('/my/places/{id}/photos', [\App\Http\Controllers\PlaceController::class, 'addPhoto'])
            ->whereNumber('id')->middleware('throttle:20,60');
        Route::post('/my/places/{id}/resubmit', [\App\Http\Controllers\PlaceController::class, 'resubmit'])
            ->whereNumber('id')->middleware('throttle:20,60');
        Route::delete('/my/places/{id}', [\App\Http\Controllers\PlaceController::class, 'destroy'])
            ->whereNumber('id')->middleware('throttle:20,60');
        Route::delete('/my/place-photos/{id}', [\App\Http\Controllers\PlaceController::class, 'deletePhoto'])
            ->whereNumber('id')->middleware('throttle:20,60');
        Route::post('/my/place-photos/{id}/rotate', [\App\Http\Controllers\PlaceController::class, 'rotatePhoto'])
            ->whereNumber('id')->middleware('throttle:20,60');
        Route::get('/my/saves', [\App\Http\Controllers\PlaceEngagementController::class, 'mySaves'])
            ->middleware('throttle:60,1');

        Route::post('/places/{id}/save', [\App\Http\Controllers\PlaceEngagementController::class, 'save'])
            ->whereNumber('id')->middleware('throttle:60,1');
        Route::delete('/places/{id}/save', [\App\Http\Controllers\PlaceEngagementController::class, 'unsave'])
            ->whereNumber('id')->middleware('throttle:60,1');
    });

    // 2. Polls & General Admin Panel (accessible to core admins and superadmins)
    // Poll management lives in the unified user dashboard (/dashboard polls tab).
    // The legacy /admin/polls/* pages were removed to avoid a duplicate editor;
    // keep redirects so old bookmarks/links land on the dashboard editor.
    Route::redirect('/admin/polls', '/dashboard', 301);
    Route::redirect('/admin/polls/create', '/dashboard?create-poll=1', 301);
    Route::redirect('/admin/polls/{id}/edit', '/dashboard?edit-poll={id}', 301);
    Route::middleware('polls_admin')->group(function () {
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
            $candidateGroup = \App\Http\Controllers\CandidateGroupController::class;
            // Read-only, and tagged `any` to keep the previous breadth: any
            // single polls capability could read these before, and reads are
            // not the risk writes are. Only mutating actions are separated.
            Route::get('/candidate-groups', [$candidateGroup, 'index'])
                ->middleware('polls_admin:any');
            Route::get('/candidate-groups/{id}', [$candidateGroup, 'show'])
                ->middleware('polls_admin:any');

            Route::post('/candidate-groups', [$candidateGroup, 'store'])
                ->middleware('polls_admin:polls.create');
            Route::put('/candidate-groups/{id}', [$candidateGroup, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::patch('/candidate-groups/{id}', [$candidateGroup, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::delete('/candidate-groups/{id}', [$candidateGroup, 'destroy'])
                ->middleware('polls_admin:polls.delete');

            Route::post('/candidate-groups/reorder', [$candidateGroup, 'reorder'])
                ->middleware('polls_admin:polls.edit');
            Route::post('/candidate-groups/{id}/default', [$candidateGroup, 'setDefault'])
                ->middleware('polls_admin:polls.edit');

            $candidate = \App\Http\Controllers\CandidateController::class;
            Route::post('/candidates', [$candidate, 'store'])
                ->middleware('polls_admin:polls.create');
            Route::put('/candidates/{id}', [$candidate, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::patch('/candidates/{id}', [$candidate, 'update'])
                ->middleware('polls_admin:polls.edit');
            Route::delete('/candidates/{id}', [$candidate, 'destroy'])
                ->middleware('polls_admin:polls.delete');

            Route::patch('/candidates/{id}/archive', [$candidate, 'archive'])
                ->middleware('polls_admin:polls.edit');
            Route::patch('/candidates/{id}/restore', [$candidate, 'restore'])
                ->middleware('polls_admin:polls.edit');
        });
    });

    Route::middleware('admin')->group(function () {
        // Guess Who content management (migrated from Filament)
        Route::get('/admin/guesswho', [\App\Http\Controllers\GuessWhoAdminController::class, 'renderIndex']);

        Route::prefix('api/v1/admin/guesswho')->group(function () {
            Route::post('/categories', [\App\Http\Controllers\GuessWhoAdminController::class, 'storeCategory']);
            Route::post('/categories/{id}', [\App\Http\Controllers\GuessWhoAdminController::class, 'updateCategory'])->whereNumber('id');
            Route::put('/categories/{id}', [\App\Http\Controllers\GuessWhoAdminController::class, 'updateCategory'])->whereNumber('id');
            Route::delete('/categories/{id}', [\App\Http\Controllers\GuessWhoAdminController::class, 'destroyCategory'])->whereNumber('id');

            Route::post('/characters', [\App\Http\Controllers\GuessWhoAdminController::class, 'storeCharacter']);
            Route::post('/characters/{id}', [\App\Http\Controllers\GuessWhoAdminController::class, 'updateCharacter'])->whereNumber('id');
            Route::put('/characters/{id}', [\App\Http\Controllers\GuessWhoAdminController::class, 'updateCharacter'])->whereNumber('id');
            Route::delete('/characters/{id}', [\App\Http\Controllers\GuessWhoAdminController::class, 'destroyCharacter'])->whereNumber('id');
        });
    });

    // 2b. Hidden Places moderation (core admins, superadmins, places.* holders)
    Route::middleware('places_admin')->group(function () {
        Route::get('/admin/places', [\App\Http\Controllers\PlaceAdminController::class, 'renderIndex'])
            ->middleware('places_admin:any');

        Route::prefix('api/v1')->middleware('throttle:60,1')->group(function () {
            Route::get('/admin/places', [\App\Http\Controllers\PlaceAdminController::class, 'index'])
                ->middleware('places_admin:places.review');
            Route::post('/admin/places/{id}/approve', [\App\Http\Controllers\PlaceAdminController::class, 'approve'])->whereNumber('id')
                ->middleware('places_admin:places.approve');
            Route::post('/admin/places/{id}/reject', [\App\Http\Controllers\PlaceAdminController::class, 'reject'])->whereNumber('id')
                ->middleware('places_admin:places.approve');
            Route::patch('/admin/places/{id}', [\App\Http\Controllers\PlaceAdminController::class, 'update'])->whereNumber('id')
                ->middleware('places_admin:places.edit');
            Route::delete('/admin/places/{id}', [\App\Http\Controllers\PlaceAdminController::class, 'destroy'])->whereNumber('id')
                ->middleware('places_admin:places.delete');
            // Adding a photo creates content on someone else's submission, so it
            // is an edit of the place, not a photo-moderation action. Rotating,
            // replacing and deleting operate on photos that already exist, which
            // is what places.moderate_photos covers.
            Route::post('/admin/places/{id}/photos', [\App\Http\Controllers\PlaceAdminController::class, 'addPhoto'])->whereNumber('id')
                ->middleware('places_admin:places.edit');
            Route::post('/admin/place-photos/{id}/rotate', [\App\Http\Controllers\PlaceAdminController::class, 'rotatePhoto'])->whereNumber('id')
                ->middleware('places_admin:places.moderate_photos');
            Route::post('/admin/place-photos/{id}/replace', [\App\Http\Controllers\PlaceAdminController::class, 'replacePhoto'])->whereNumber('id')
                ->middleware('places_admin:places.moderate_photos');
            Route::delete('/admin/place-photos/{id}', [\App\Http\Controllers\PlaceAdminController::class, 'deletePhoto'])->whereNumber('id')
                ->middleware('places_admin:places.moderate_photos');
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

        Route::prefix('api/v1')->group(function () {
            Route::get('/admin/route-drafts', [\App\Http\Controllers\TransitAdminController::class, 'index'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::post('/admin/route-drafts/{id}/approve', [\App\Http\Controllers\TransitAdminController::class, 'approve'])
                ->middleware('transit_admin:transit.approve');
            Route::post('/admin/route-drafts/{id}/reject', [\App\Http\Controllers\TransitAdminController::class, 'reject'])
                ->middleware('transit_admin:transit.reject');

            Route::get('/admin/routes', [\App\Http\Controllers\TransitAdminController::class, 'getPublishedRoutes'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::get('/admin/routes/logs', [\App\Http\Controllers\TransitAdminController::class, 'getLogs'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::get('/admin/routes/{id}/geojson', [\App\Http\Controllers\TransitAdminController::class, 'getRouteGeoJson'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::post('/admin/routes/{id}/status', [\App\Http\Controllers\TransitAdminController::class, 'updateRouteStatus'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::put('/admin/routes/{id}', [\App\Http\Controllers\TransitAdminController::class, 'updateRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::delete('/admin/routes/{id}', [\App\Http\Controllers\TransitAdminController::class, 'destroy'])
                ->middleware('transit_admin:transit.delete_routes');
            Route::post('/admin/routes/{id}/move', [\App\Http\Controllers\TransitAdminController::class, 'moveRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/admin/routes/combine', [\App\Http\Controllers\TransitAdminController::class, 'combineRoutes'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/admin/routes/split', [\App\Http\Controllers\TransitAdminController::class, 'splitRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::get('/admin/routes/{id}/stops', [\App\Http\Controllers\TransitAdminController::class, 'getRouteStops'])
                ->middleware('transit_admin:transit.review_drafts');
            // Preview responses are cached per-mid for an hour, so repeated
            // reviews are cheap: allow an admin-friendly rate instead of
            // blocking legitimate retry loops with 429s.
            Route::post('/admin/routes/import-preview', [\App\Http\Controllers\TransitImportController::class, 'preview'])
                ->middleware(['transit_admin:transit.review_drafts', 'throttle:30,1']);
            Route::post('/admin/routes/import-publish', [\App\Http\Controllers\TransitImportController::class, 'publish'])
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
    // There is no "ban users" capability in PermissionCatalogue, so the gate is
    // DashboardController::toggleBan's own role check (admin / transit_admin /
    // superadmin). Adding a real capability for it is a separate decision.
    //
    // No throttle added: this route had none before, and picking a limit is an
    // operator decision rather than a side effect of moving it.
    Route::post('/api/admin/users/{id}/toggle-ban', [DashboardController::class, 'toggleBan']);

    // 4. SyOfficial Admin Panel (accessible to core admins, syofficial_admin, and superadmins)
    Route::middleware('syofficial_admin')->group(function () {
        Route::get('/admin/syofficial', [\App\Http\Controllers\SyOfficialAdminController::class, 'renderIndex'])
            ->middleware('syofficial_admin:any');

        Route::prefix('api/v1/admin/syofficial')->group(function () {
            Route::post('/categories', [\App\Http\Controllers\SyOfficialAdminController::class, 'storeCategory'])
                ->middleware('syofficial_admin:syofficial.create');
            Route::put('/categories/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'updateCategory'])
                ->middleware('syofficial_admin:syofficial.edit');
            // Cascades to every entity in the category, so it is gated on delete
            // alone and not on any of the other four.
            Route::delete('/categories/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'destroyCategory'])
                ->middleware('syofficial_admin:syofficial.delete');

            Route::post('/entities', [\App\Http\Controllers\SyOfficialAdminController::class, 'storeEntity'])
                ->middleware('syofficial_admin:syofficial.create');
            Route::post('/entities/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'updateEntity'])
                ->middleware('syofficial_admin:syofficial.edit');
            Route::put('/entities/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'updateEntity'])
                ->middleware('syofficial_admin:syofficial.edit');
            Route::delete('/entities/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'destroyEntity'])
                ->middleware('syofficial_admin:syofficial.delete');

            Route::post('/reorder/categories', [\App\Http\Controllers\SyOfficialAdminController::class, 'reorderCategories'])
                ->middleware('syofficial_admin:syofficial.reorder');
            Route::post('/reorder/entities', [\App\Http\Controllers\SyOfficialAdminController::class, 'reorderEntities'])
                ->middleware('syofficial_admin:syofficial.reorder');
        });
    });

    // 5. GovApps Admin Panel
    Route::middleware('govapps_admin')->group(function () {
        Route::get('/admin/govapps', [\App\Http\Controllers\GovAppsAdminController::class, 'renderIndex'])
            ->middleware('govapps_admin:any');

        Route::prefix('api/v1/admin/govapps')->group(function () {
            Route::post('/', [\App\Http\Controllers\GovAppsAdminController::class, 'store'])
                ->middleware('govapps_admin:govapps.create');
            Route::post('/reorder', [\App\Http\Controllers\GovAppsAdminController::class, 'reorder'])
                ->middleware('govapps_admin:govapps.reorder');
            Route::post('/{id}', [\App\Http\Controllers\GovAppsAdminController::class, 'update'])
                ->middleware('govapps_admin:govapps.edit');
            Route::put('/{id}', [\App\Http\Controllers\GovAppsAdminController::class, 'update'])
                ->middleware('govapps_admin:govapps.edit');
            Route::delete('/{id}', [\App\Http\Controllers\GovAppsAdminController::class, 'destroy'])
                ->middleware('govapps_admin:govapps.delete');
        });
    });

    // 6. Phonebook Admin Panel
    Route::middleware('phonebook_admin')->group(function () {
        Route::get('/admin/phonebook', [\App\Http\Controllers\PhonebookAdminController::class, 'renderIndex'])
            ->middleware('phonebook_admin:any');

        Route::prefix('api/v1/admin/phonebook')->group(function () {
            Route::post('/categories', [\App\Http\Controllers\PhonebookAdminController::class, 'storeCategory'])
                ->middleware('phonebook_admin:phonebook.create');
            Route::put('/categories/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'updateCategory'])
                ->middleware('phonebook_admin:phonebook.edit');
            Route::delete('/categories/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'destroyCategory'])
                ->middleware('phonebook_admin:phonebook.delete');

            Route::post('/entries', [\App\Http\Controllers\PhonebookAdminController::class, 'storeEntry'])
                ->middleware('phonebook_admin:phonebook.create');
            Route::post('/entries/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'updateEntry'])
                ->middleware('phonebook_admin:phonebook.edit');
            Route::put('/entries/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'updateEntry'])
                ->middleware('phonebook_admin:phonebook.edit');
            Route::post('/entries/{id}/toggle', [\App\Http\Controllers\PhonebookAdminController::class, 'toggleEntryActive'])
                ->middleware('phonebook_admin:phonebook.toggle');
            Route::delete('/entries/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'destroyEntry'])
                ->middleware('phonebook_admin:phonebook.delete');

            Route::post('/reorder/categories', [\App\Http\Controllers\PhonebookAdminController::class, 'reorderCategories'])
                ->middleware('phonebook_admin:phonebook.reorder');
            Route::post('/reorder/entries', [\App\Http\Controllers\PhonebookAdminController::class, 'reorderEntries'])
                ->middleware('phonebook_admin:phonebook.reorder');
        });
    });
});

// User settings API endpoint (throttled + whitelisted: previously accepted
// arbitrary keys of unbounded size on every keystroke).
Route::post('/api/user/settings', function (\Illuminate\Http\Request $request) {
    $user = $request->user();
    if (!$user) {
        return response()->json(['error' => 'Unauthenticated'], 401);
    }

    $validated = $request->validate([
        'settings' => 'required|array|max:30',
        'settings.theme' => 'nullable|string|max:64',
        'settings.fontFamily' => 'nullable|string|in:ibm-plex,system',
        'settings.language' => 'nullable|string|in:ar,en',
        'settings.governorate' => 'nullable|string|max:64',
        'settings.eventsGovernorate' => 'nullable|string|max:64',
        'settings.clockFormat' => 'nullable|string|in:12,24',
        'settings.searchEngine' => 'nullable|string|in:duckduckgo,google,bing,searx,custom',
        'settings.showClock' => 'nullable|boolean',
        'settings.showWeather' => 'nullable|boolean',
        'settings.showPrayerTimes' => 'nullable|boolean',
        'settings.muslimCity' => 'nullable|string|max:64',
        'settings.muslimMethod' => 'nullable|integer|in:0,1,2,3,4,5,7,8,9,10,11,12,13,14,15,16',
        'settings.muslimUseCustomCoords' => 'nullable|boolean',
        'settings.muslimLat' => 'nullable|numeric|between:-90,90',
        'settings.muslimLon' => 'nullable|numeric|between:-180,180',
        'settings.prayerLog' => 'nullable|array|max:31',
        'settings.prayerLog.*' => 'nullable|array|max:5',
        'settings.prayerLog.*.*' => 'boolean',
        'settings.quranLastPage' => 'nullable|integer|min:1|max:604',
        'settings.quranLastJuz' => 'nullable|integer|min:1|max:30',
        'settings.quranPageAt' => 'nullable|integer|min:0',
        'settings.quranReciterId' => 'nullable|string|max:64',
        'settings.showEvents' => 'nullable|boolean',
        'settings.showSearch' => 'nullable|boolean',
        'settings.useCustomCoords' => 'nullable|boolean',
        'settings.customLat' => 'nullable|numeric|between:-90,90',
        'settings.customLon' => 'nullable|numeric|between:-180,180',
        'settings.customSearchUrl' => 'nullable|string|max:2048|starts_with:http://,https://',
        'settings.customLinks' => 'nullable|array|max:50',
        'settings.customLinks.*.id' => 'required|string|max:64',
        'settings.customLinks.*.label' => 'nullable|string|max:100',
        'settings.customLinks.*.name' => 'nullable|string|max:100',
        'settings.customLinks.*.title' => 'nullable|string|max:100',
        'settings.customLinks.*.url' => 'required|string|max:2048|starts_with:http://,https://',
    ]);

    $newSettings = $validated['settings'] ?? [];
    // customLinks replaces wholesale; cap JSON size so one client cannot bloat the row.
    if (isset($newSettings['customLinks']) && strlen(json_encode($newSettings['customLinks'])) > 20000) {
        return response()->json(['error' => 'Too many links.'], 422);
    }

    $currentSettings = $user->settings ?? [];

    $mergedSettings = array_merge($currentSettings, $newSettings);
    if (strlen(json_encode($mergedSettings)) > 40000) {
        return response()->json(['error' => 'Settings too large.'], 422);
    }
    $user->settings = $mergedSettings;
    $user->save();

    return response()->json(['status' => 'ok', 'settings' => $user->settings]);
})->middleware('throttle:60,1');

// Dev-only: impersonate a user role for local development (never registered in production).
use App\Http\Controllers\DevController;

Route::get('/dev/impersonate/{role}', [DevController::class, 'impersonate'])
    ->name('dev.impersonate')
    ->middleware(\App\Http\Middleware\AutoLoginDevUser::class);

