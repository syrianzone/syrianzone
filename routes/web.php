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
    return redirect("/transit/city/{$id}", 301);
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

    Route::prefix('api')->group(function () {
        Route::get('/user', function (\Illuminate\Http\Request $request) {
            return $request->user();
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
            Route::post('/polls', [PollController::class, 'store']);
            Route::put('/polls/{id}', [PollController::class, 'update']);
            Route::delete('/polls/{id}', [PollController::class, 'destroy']);

            Route::apiResource('candidate-groups', \App\Http\Controllers\CandidateGroupController::class);
            Route::post('/candidate-groups/reorder', [\App\Http\Controllers\CandidateGroupController::class, 'reorder']);
            Route::post('/candidate-groups/{id}/default', [\App\Http\Controllers\CandidateGroupController::class, 'setDefault']);

            Route::apiResource('candidates', \App\Http\Controllers\CandidateController::class)->except(['index', 'show']);
            Route::patch('/candidates/{id}/archive', [\App\Http\Controllers\CandidateController::class, 'archive']);
            Route::patch('/candidates/{id}/restore', [\App\Http\Controllers\CandidateController::class, 'restore']);
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
        Route::get('/admin/places', [\App\Http\Controllers\PlaceAdminController::class, 'renderIndex']);

        Route::prefix('api/v1')->middleware('throttle:60,1')->group(function () {
            Route::get('/admin/places', [\App\Http\Controllers\PlaceAdminController::class, 'index']);
            Route::post('/admin/places/{id}/approve', [\App\Http\Controllers\PlaceAdminController::class, 'approve'])->whereNumber('id');
            Route::post('/admin/places/{id}/reject', [\App\Http\Controllers\PlaceAdminController::class, 'reject'])->whereNumber('id');
            Route::patch('/admin/places/{id}', [\App\Http\Controllers\PlaceAdminController::class, 'update'])->whereNumber('id');
            Route::delete('/admin/places/{id}', [\App\Http\Controllers\PlaceAdminController::class, 'destroy'])->whereNumber('id');
            Route::post('/admin/places/{id}/photos', [\App\Http\Controllers\PlaceAdminController::class, 'addPhoto'])->whereNumber('id');
            Route::post('/admin/place-photos/{id}/rotate', [\App\Http\Controllers\PlaceAdminController::class, 'rotatePhoto'])->whereNumber('id');
            Route::post('/admin/place-photos/{id}/replace', [\App\Http\Controllers\PlaceAdminController::class, 'replacePhoto'])->whereNumber('id');
            Route::delete('/admin/place-photos/{id}', [\App\Http\Controllers\PlaceAdminController::class, 'deletePhoto'])->whereNumber('id');
        });
    });

    // 3. Transit Admin Panel. The page shell needs any review capability;
    // mutating endpoints require the matching granular transit.* permission.
    Route::middleware('transit_admin')->group(function () {
        Route::get('/transit/admin', function () {
            return Inertia::render('Transit/admin/Index');
        });

        Route::post('/api/admin/users/{id}/toggle-ban', [DashboardController::class, 'toggleBan']);

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
            Route::post('/admin/routes/{id}/move', [\App\Http\Controllers\TransitAdminController::class, 'moveRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/admin/routes/combine', [\App\Http\Controllers\TransitAdminController::class, 'combineRoutes'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/admin/routes/split', [\App\Http\Controllers\TransitAdminController::class, 'splitRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::get('/admin/routes/{id}/stops', [\App\Http\Controllers\TransitAdminController::class, 'getRouteStops'])
                ->middleware('transit_admin:transit.review_drafts');
        });
    });

    // 4. SyOfficial Admin Panel (accessible to core admins, syofficial_admin, and superadmins)
    Route::middleware('syofficial_admin')->group(function () {
        Route::get('/admin/syofficial', [\App\Http\Controllers\SyOfficialAdminController::class, 'renderIndex']);

        Route::prefix('api/v1/admin/syofficial')->group(function () {
            Route::post('/categories', [\App\Http\Controllers\SyOfficialAdminController::class, 'storeCategory']);
            Route::put('/categories/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'updateCategory']);
            Route::delete('/categories/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'destroyCategory']);

            Route::post('/entities', [\App\Http\Controllers\SyOfficialAdminController::class, 'storeEntity']);
            Route::post('/entities/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'updateEntity']);
            Route::put('/entities/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'updateEntity']);
            Route::delete('/entities/{id}', [\App\Http\Controllers\SyOfficialAdminController::class, 'destroyEntity']);

            Route::post('/reorder/categories', [\App\Http\Controllers\SyOfficialAdminController::class, 'reorderCategories']);
            Route::post('/reorder/entities', [\App\Http\Controllers\SyOfficialAdminController::class, 'reorderEntities']);
        });
    });

    // 5. GovApps Admin Panel
    Route::middleware(\App\Http\Middleware\GovAppsAdmin::class)->group(function () {
        Route::get('/admin/govapps', [\App\Http\Controllers\GovAppsAdminController::class, 'renderIndex']);

        Route::prefix('api/v1/admin/govapps')->group(function () {
            Route::post('/', [\App\Http\Controllers\GovAppsAdminController::class, 'store']);
            Route::post('/reorder', [\App\Http\Controllers\GovAppsAdminController::class, 'reorder']);
            Route::post('/{id}', [\App\Http\Controllers\GovAppsAdminController::class, 'update']);
            Route::put('/{id}', [\App\Http\Controllers\GovAppsAdminController::class, 'update']);
            Route::delete('/{id}', [\App\Http\Controllers\GovAppsAdminController::class, 'destroy']);
        });
    });

    // 6. Phonebook Admin Panel
    Route::middleware('phonebook_admin')->group(function () {
        Route::get('/admin/phonebook', [\App\Http\Controllers\PhonebookAdminController::class, 'renderIndex']);

        Route::prefix('api/v1/admin/phonebook')->group(function () {
            Route::post('/categories', [\App\Http\Controllers\PhonebookAdminController::class, 'storeCategory']);
            Route::put('/categories/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'updateCategory']);
            Route::delete('/categories/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'destroyCategory']);

            Route::post('/entries', [\App\Http\Controllers\PhonebookAdminController::class, 'storeEntry']);
            Route::post('/entries/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'updateEntry']);
            Route::put('/entries/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'updateEntry']);
            Route::post('/entries/{id}/toggle', [\App\Http\Controllers\PhonebookAdminController::class, 'toggleEntryActive']);
            Route::delete('/entries/{id}', [\App\Http\Controllers\PhonebookAdminController::class, 'destroyEntry']);

            Route::post('/reorder/categories', [\App\Http\Controllers\PhonebookAdminController::class, 'reorderCategories']);
            Route::post('/reorder/entries', [\App\Http\Controllers\PhonebookAdminController::class, 'reorderEntries']);
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
        'settings.clockFormat' => 'nullable|string|in:12,24',
        'settings.searchEngine' => 'nullable|string|in:duckduckgo,google,bing,searx,custom',
        'settings.showClock' => 'nullable|boolean',
        'settings.showWeather' => 'nullable|boolean',
        'settings.showPrayerTimes' => 'nullable|boolean',
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

