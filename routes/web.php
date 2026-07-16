<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\GuessWhoController;
use App\Http\Controllers\SignalingController;

Route::get('/', [HomeController::class, 'index']);

Route::get('/healthcheck', function () {
    return response('OK', 200)->header('Content-Type', 'text/plain');
});

use App\Http\Controllers\SyOfficialController;
use App\Http\Controllers\PollController;

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

Route::get('/guesswho', [GuessWhoController::class, 'index']);
Route::post('/guesswho/rooms', [GuessWhoController::class, 'createRoom']);
Route::get('/guesswho/room/{roomCode}', [GuessWhoController::class, 'showRoom']);
Route::post('/guesswho/room/{roomCode}/join', [GuessWhoController::class, 'joinRoom']);
Route::post('/guesswho/room/{roomCode}/signal', [SignalingController::class, 'signal']);
Route::post('/guesswho/broadcasting/auth', [GuessWhoController::class, 'authenticateBroadcasting']);

Route::get('/transit', function () {
    return Inertia::render('Transit/Index');
});

Route::get('/transit/city/{id}', function ($id) {
    return Inertia::render('Transit/city/[id]/Index', ['id' => $id]);
})->where('id', '[a-z0-9\-]+');

Route::get('/transit/city/{id}/map', function ($id) {
    return Inertia::render('Transit/city/[id]/map/Index', ['id' => $id]);
})->where('id', '[a-z0-9\-]+');

Route::get('/transit/city/{id}/route/{routeId}', function ($id, $routeId) {
    $citiesPath = resource_path('js/Pages/Transit/_data/cities.json');
    if (!file_exists($citiesPath)) {
        abort(404, 'Cities configuration not found.');
    }
    
    $cities = json_decode(file_get_contents($citiesPath), true);
    $city = collect($cities)->firstWhere('id', $id);
    
    if (!$city) {
        return Inertia::render('Transit/city/[id]/route/[routeId]/Index', [
            'id' => $id,
            'city' => null,
            'route' => null,
            'stops' => []
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
        'stops' => $stopsData
    ]);
})->where(['id' => '[a-z0-9\-]+', 'routeId' => '[a-z0-9\-]+']);

Route::get('/transit/studio', function () {
    return Inertia::render('Transit/studio/Index');
});

Route::get('/places', [\App\Http\Controllers\PlaceController::class, 'renderIndex']);



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
    Route::post('/api/account/delete', [DashboardController::class, 'deleteAccount']);

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
        Route::post('/places', [\App\Http\Controllers\PlaceController::class, 'store'])
            ->middleware('throttle:5,60');
        Route::get('/my/places', [\App\Http\Controllers\PlaceController::class, 'mine'])
            ->middleware('throttle:60,1');
        Route::get('/my/saves', [\App\Http\Controllers\PlaceEngagementController::class, 'mySaves'])
            ->middleware('throttle:60,1');

        Route::post('/places/{id}/like', [\App\Http\Controllers\PlaceEngagementController::class, 'like'])
            ->whereNumber('id')->middleware('throttle:60,1');
        Route::delete('/places/{id}/like', [\App\Http\Controllers\PlaceEngagementController::class, 'unlike'])
            ->whereNumber('id')->middleware('throttle:60,1');
        Route::post('/places/{id}/save', [\App\Http\Controllers\PlaceEngagementController::class, 'save'])
            ->whereNumber('id')->middleware('throttle:60,1');
        Route::delete('/places/{id}/save', [\App\Http\Controllers\PlaceEngagementController::class, 'unsave'])
            ->whereNumber('id')->middleware('throttle:60,1');
        Route::post('/places/{id}/comments', [\App\Http\Controllers\PlaceEngagementController::class, 'storeComment'])
            ->whereNumber('id')->middleware('throttle:10,1');
        Route::delete('/place-comments/{id}', [\App\Http\Controllers\PlaceEngagementController::class, 'destroyComment'])
            ->whereNumber('id')->middleware('throttle:60,1');
        Route::post('/places/{id}/report', [\App\Http\Controllers\PlaceEngagementController::class, 'report'])
            ->whereNumber('id')->middleware('throttle:5,60');
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
            Route::delete('/admin/places/{id}', [\App\Http\Controllers\PlaceAdminController::class, 'destroy'])->whereNumber('id');
            Route::get('/admin/place-reports', [\App\Http\Controllers\PlaceAdminController::class, 'reports']);
            Route::post('/admin/place-reports/{id}/resolve', [\App\Http\Controllers\PlaceAdminController::class, 'resolveReport'])->whereNumber('id');
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
        });
    });
});


