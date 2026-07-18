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
Route::get('/govapps', [ExternalDataController::class, 'govapps']);
Route::get('/population', [PopulationAtlasController::class, 'renderIndex']);
Route::get('/central', function () {
    return Inertia::render('Central/Index');
});

Route::get('/guesswho', [GuessWhoController::class, 'index']);
Route::post('/guesswho/rooms', [GuessWhoController::class, 'createRoom']);
Route::get('/guesswho/room/{roomCode}', [GuessWhoController::class, 'showRoom']);
Route::post('/guesswho/room/{roomCode}/join', [GuessWhoController::class, 'joinRoom']);
Route::post('/guesswho/room/{roomCode}/signal', [SignalingController::class, 'signal']);
Route::post('/guesswho/broadcasting/auth', [GuessWhoController::class, 'authenticateBroadcasting']);

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
    return Inertia::render('Transit/city/[id]/map/Index', ['id' => $id]);
})->where('id', '[a-z0-9\-]+');

Route::get('/transit/city/{id}/route/{routeId}', function ($id, $routeId) {
    $citiesPath = resource_path('js/Pages/Transit/_data/cities.json');
    if (! file_exists($citiesPath)) {
        abort(404, 'Cities configuration not found.');
    }

    $cities = json_decode(file_get_contents($citiesPath), true);
    $city = collect($cities)->firstWhere('id', $id);

    if (! $city) {
        return Inertia::render('Transit/city/[id]/route/[routeId]/Index', [
            'id' => $id,
            'city' => null,
            'route' => null,
            'stops' => [],
        ]);
    }

    // Read route + stops from the database — the same source the live map uses — so
    // admin-approved community routes appear here too (the old static GeoJSON files in
    // public/data are never updated on approval, so they drifted out of sync).
    $route = \Illuminate\Support\Facades\DB::table('routes')
        ->where('id', $routeId)
        ->where('city_id', $id)
        ->where('status', 'published')
        ->first();

    $routeData = $route ? [
        'id' => $route->id,
        'nameAr' => $route->name_ar,
        'nameEn' => $route->name_en,
        'colorIndex' => $route->color_index,
        'priceOld' => $route->price_old,
        'priceNew' => $route->price_new,
    ] : null;

    $stopsData = [];

    if ($routeData) {
        $stops = \Illuminate\Support\Facades\DB::table('route_stop')
            ->join('stops', 'route_stop.stop_id', '=', 'stops.id')
            ->where('route_stop.route_id', $routeId)
            ->orderBy('route_stop.order')
            ->select('stops.id', 'stops.name_ar', \Illuminate\Support\Facades\DB::raw('ST_AsGeoJSON(stops.geometry) as geojson'))
            ->get();

        $stopsData = $stops->map(function ($s) {
            $coordinates = json_decode($s->geojson, true)['coordinates'] ?? [0, 0];

            return [
                'properties' => [
                    'id' => $s->id,
                    'nameAr' => $s->name_ar,
                ],
                'coordinates' => $coordinates,
            ];
        })->all();
    }

    return Inertia::render('Transit/city/[id]/route/[routeId]/Index', [
        'id' => $id,
        'city' => $city,
        'route' => $routeData,
        'stops' => $stopsData,
    ]);
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

    // Hidden Places: authenticated writes (session + CSRF via the web group)
    Route::prefix('api/v1')->group(function () {
        // Coarse abuse shield only; the real 5-per-hour quota counts created
        // places in the controller, so failed validation attempts don't lock users out.
        Route::post('/places', [\App\Http\Controllers\PlaceController::class, 'store'])
            ->middleware('throttle:20,60');
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
    Route::middleware('admin')->group(function () {
        Route::get('/admin/polls', [PollController::class, 'renderIndex']);
        Route::get('/admin/polls/create', [PollController::class, 'adminCreate']);
        Route::get('/admin/polls/{id}/edit', [PollController::class, 'adminEdit']);

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

        // Hidden Places moderation
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

    // 3. Transit Admin Panel (accessible to core admins, transit admins, and superadmins)
    Route::middleware('transit_admin')->group(function () {
        Route::get('/transit/admin', function () {
            return Inertia::render('Transit/admin/Index');
        });

        Route::post('/api/admin/users/{id}/toggle-ban', [DashboardController::class, 'toggleBan']);

        Route::prefix('api/v1')->group(function () {
            Route::get('/admin/route-drafts', [\App\Http\Controllers\TransitAdminController::class, 'index']);
            Route::post('/admin/route-drafts/{id}/approve', [\App\Http\Controllers\TransitAdminController::class, 'approve']);
            Route::post('/admin/route-drafts/{id}/reject', [\App\Http\Controllers\TransitAdminController::class, 'reject']);

            Route::get('/admin/routes', [\App\Http\Controllers\TransitAdminController::class, 'getPublishedRoutes']);
            Route::get('/admin/routes/logs', [\App\Http\Controllers\TransitAdminController::class, 'getLogs']);
            Route::post('/admin/routes/{id}/status', [\App\Http\Controllers\TransitAdminController::class, 'updateRouteStatus']);
            Route::put('/admin/routes/{id}', [\App\Http\Controllers\TransitAdminController::class, 'updateRoute']);
            Route::post('/admin/routes/{id}/move', [\App\Http\Controllers\TransitAdminController::class, 'moveRoute']);
            Route::post('/admin/routes/combine', [\App\Http\Controllers\TransitAdminController::class, 'combineRoutes']);
            Route::post('/admin/routes/split', [\App\Http\Controllers\TransitAdminController::class, 'splitRoute']);
            Route::get('/admin/routes/{id}/stops', [\App\Http\Controllers\TransitAdminController::class, 'getRouteStops']);
            Route::get('/admin/routes/{id}/geojson', [\App\Http\Controllers\TransitAdminController::class, 'getRouteGeoJson']);
        });
    });
});

// Dev-only: impersonate a user role for local development (never registered in production).
use App\Http\Controllers\DevController;

Route::get('/dev/impersonate/{role}', [DevController::class, 'impersonate'])
    ->name('dev.impersonate')
    ->middleware(\App\Http\Middleware\AutoLoginDevUser::class);
