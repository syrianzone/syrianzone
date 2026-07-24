<?php

use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\Api\PopulationAtlasController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\CandidateController;
use App\Http\Controllers\CandidateGroupController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DevController;
use App\Http\Controllers\ExternalDataController;
use App\Http\Controllers\GovAppController;
use App\Http\Controllers\GovAppsAdminController;
use App\Http\Controllers\GuessWhoController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\PhonebookAdminController;
use App\Http\Controllers\PhonebookController;
use App\Http\Controllers\PlaceAdminController;
use App\Http\Controllers\PlaceController;
use App\Http\Controllers\PollController;
use App\Http\Controllers\SignalingController;
use App\Http\Controllers\SyOfficialAdminController;
use App\Http\Controllers\SyOfficialController;
use App\Http\Controllers\TransitAdminController;
use App\Http\Middleware\AutoLoginDevUser;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\GovAppsAdmin;
use App\Models\City;
use App\Services\UserSettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', [HomeController::class, 'index']);

Route::get('/healthcheck', function () {
    return response('OK', 200)->header('Content-Type', 'text/plain');
});

Route::get('/syofficial', [SyOfficialController::class, 'index']);
Route::get('/polls', [PollController::class, 'renderIndex']);
Route::get('/polls/{slug}', [PollController::class, 'renderShow']);
Route::get('/polls/{slug}/leaderboard', [PollController::class, 'renderLeaderboard']);

Route::get('/tierlist', [PollController::class, 'renderTierList']);
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
Route::get('/phonebook', [PhonebookController::class, 'index']);
Route::get('/shawarma', function () {
    return Inertia::render('Shawarma/Index');
});
Route::get('/justice', function () {
    return Inertia::render('Justice/Index');
});
Route::get('/about', function () {
    return Inertia::render('About');
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
Route::get('/population', [PopulationAtlasController::class, 'renderIndex']);

Route::get('/guesswho', [GuessWhoController::class, 'index']);
Route::post('/guesswho/rooms', [GuessWhoController::class, 'createRoom']);
Route::get('/guesswho/room/{roomCode}', [GuessWhoController::class, 'showRoom']);
Route::post('/guesswho/room/{roomCode}/join', [GuessWhoController::class, 'joinRoom']);
Route::post('/guesswho/room/{roomCode}/signal', [SignalingController::class, 'signal']);
Route::post('/guesswho/broadcasting/auth', [GuessWhoController::class, 'authenticateBroadcasting']);

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

    // Read route and stops from the database, the same source the live map uses, so
    // admin-approved community routes appear here too (the old static GeoJSON files in
    // public/data are never updated on approval, so they drifted out of sync).
    $route = DB::table('routes')
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
        $stops = DB::table('route_stop')
            ->join('stops', 'route_stop.stop_id', '=', 'stops.id')
            ->where('route_stop.route_id', $routeId)
            ->orderBy('route_stop.order')
            ->select('stops.id', 'stops.name_ar', 'stops.name_en', DB::raw('ST_AsGeoJSON(stops.geometry) as geojson'))
            ->get();

        $stopsData = $stops->map(function ($s) {
            $coordinates = json_decode($s->geojson, true)['coordinates'] ?? [0, 0];

            return [
                'properties' => [
                    'id' => $s->id,
                    'nameAr' => $s->name_ar,
                    'nameEn' => $s->name_en,
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

Route::get('/mishwar', [PlaceController::class, 'renderIndex']);
// legacy slug: share links from the first release said /places
Route::get('/places', fn () => redirect('/mishwar'.(request()->getQueryString() ? '?'.request()->getQueryString() : ''), 301));

// The board page is public: guests get a fully customizable board backed by
// localStorage, and only the sync endpoints below require auth.
Route::get('/board', [BoardController::class, 'renderIndex']);

Route::get('/user', [AuthController::class, 'user'])->middleware(EnsureUserIsActive::class);
Route::get('/auth/google', [AuthController::class, 'redirectToProvider'])->name('login');
Route::get('/auth/google/callback', [AuthController::class, 'handleProviderCallback']);
Route::post('/logout', [AuthController::class, 'logout']);

Route::middleware(['auth', EnsureUserIsActive::class])->group(function () {
    // 1. Unified User Dashboard Views and Actions
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::post('/api/account/update', [DashboardController::class, 'updateAccount']);
    Route::post('/api/account/avatar', [DashboardController::class, 'updateAvatar'])->middleware('throttle:10,1');
    Route::post('/api/account/delete', [DashboardController::class, 'deleteAccount']);

    Route::prefix('api')->group(function () {
        Route::get('/user', function (Request $request) {
            return $request->user();
        });

        Route::middleware('superadmin')->group(function () {
            Route::get('/admins', [AdminUserController::class, 'index']);
            Route::post('/admins', [AdminUserController::class, 'store']);
            Route::delete('/admins/{id}', [AdminUserController::class, 'destroy']);
        });
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

            Route::apiResource('candidate-groups', CandidateGroupController::class);
            Route::post('/candidate-groups/reorder', [CandidateGroupController::class, 'reorder']);
            Route::post('/candidate-groups/{id}/default', [CandidateGroupController::class, 'setDefault']);

            Route::apiResource('candidates', CandidateController::class)->except(['index', 'show']);
            Route::patch('/candidates/{id}/archive', [CandidateController::class, 'archive']);
            Route::patch('/candidates/{id}/restore', [CandidateController::class, 'restore']);
        });

        // Hidden Places moderation
        Route::get('/admin/places', [PlaceAdminController::class, 'renderIndex']);

    });

    // 3. Transit Admin Panel (accessible to core admins, transit admins, and superadmins)
    Route::middleware('transit_admin')->group(function () {
        Route::get('/transit/admin', function () {
            return Inertia::render('Transit/admin/Index');
        });

        Route::post('/api/admin/users/{id}/toggle-ban', [DashboardController::class, 'toggleBan']);

        Route::prefix('api/v1')->group(function () {
            Route::get('/admin/route-drafts', [TransitAdminController::class, 'index'])
                ->middleware('transit_admin:transit.review_drafts');
            Route::post('/admin/route-drafts/{id}/approve', [TransitAdminController::class, 'approve'])
                ->middleware('transit_admin:transit.approve');
            Route::post('/admin/route-drafts/{id}/reject', [TransitAdminController::class, 'reject'])
                ->middleware('transit_admin:transit.reject');
            Route::get('/admin/routes', [TransitAdminController::class, 'getPublishedRoutes'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::get('/admin/routes/logs', [TransitAdminController::class, 'getLogs'])
                ->middleware('transit_admin:transit.view_logs');
            Route::post('/admin/routes/{id}/status', [TransitAdminController::class, 'updateRouteStatus'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::put('/admin/routes/{id}', [TransitAdminController::class, 'updateRoute'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::post('/admin/routes/{id}/move', [TransitAdminController::class, 'moveRoute'])
                ->middleware('transit_admin:transit.move_routes');
            Route::post('/admin/routes/combine', [TransitAdminController::class, 'combineRoutes'])
                ->middleware('transit_admin:transit.combine_routes');
            Route::post('/admin/routes/split', [TransitAdminController::class, 'splitRoute'])
                ->middleware('transit_admin:transit.split_routes');
            Route::get('/admin/routes/{id}/stops', [TransitAdminController::class, 'getRouteStops'])
                ->middleware('transit_admin:transit.edit_routes');
            Route::get('/admin/routes/{id}/geojson', [TransitAdminController::class, 'getRouteGeoJson'])
                ->middleware('transit_admin:transit.edit_routes');
        });
    });

    // 4. SyOfficial Admin Panel (accessible to core admins, syofficial_admin, and superadmins)
    Route::middleware('syofficial_admin')->group(function () {
        Route::get('/admin/syofficial', [SyOfficialAdminController::class, 'renderIndex']);

        Route::prefix('api/v1/admin/syofficial')->group(function () {
            Route::post('/categories', [SyOfficialAdminController::class, 'storeCategory']);
            Route::put('/categories/{id}', [SyOfficialAdminController::class, 'updateCategory']);
            Route::delete('/categories/{id}', [SyOfficialAdminController::class, 'destroyCategory']);

            Route::post('/entities', [SyOfficialAdminController::class, 'storeEntity']);
            Route::post('/entities/{id}', [SyOfficialAdminController::class, 'updateEntity']);
            Route::put('/entities/{id}', [SyOfficialAdminController::class, 'updateEntity']);
            Route::delete('/entities/{id}', [SyOfficialAdminController::class, 'destroyEntity']);

            Route::post('/reorder/categories', [SyOfficialAdminController::class, 'reorderCategories']);
            Route::post('/reorder/entities', [SyOfficialAdminController::class, 'reorderEntities']);
        });
    });

    // 5. GovApps Admin Panel
    Route::middleware(GovAppsAdmin::class)->group(function () {
        Route::get('/admin/govapps', [GovAppsAdminController::class, 'renderIndex']);

        Route::prefix('api/v1/admin/govapps')->group(function () {
            Route::post('/', [GovAppsAdminController::class, 'store']);
            Route::post('/reorder', [GovAppsAdminController::class, 'reorder']);
            Route::post('/{id}', [GovAppsAdminController::class, 'update']);
            Route::put('/{id}', [GovAppsAdminController::class, 'update']);
            Route::delete('/{id}', [GovAppsAdminController::class, 'destroy']);
        });
    });

    // 6. Phonebook Admin Panel
    Route::middleware('phonebook_admin')->group(function () {
        Route::get('/admin/phonebook', [PhonebookAdminController::class, 'renderIndex']);

        Route::prefix('api/v1/admin/phonebook')->group(function () {
            Route::post('/categories', [PhonebookAdminController::class, 'storeCategory']);
            Route::put('/categories/{id}', [PhonebookAdminController::class, 'updateCategory']);
            Route::delete('/categories/{id}', [PhonebookAdminController::class, 'destroyCategory']);

            Route::post('/entries', [PhonebookAdminController::class, 'storeEntry']);
            Route::post('/entries/{id}', [PhonebookAdminController::class, 'updateEntry']);
            Route::put('/entries/{id}', [PhonebookAdminController::class, 'updateEntry']);
            Route::post('/entries/{id}/toggle', [PhonebookAdminController::class, 'toggleEntryActive']);
            Route::delete('/entries/{id}', [PhonebookAdminController::class, 'destroyEntry']);

            Route::post('/reorder/categories', [PhonebookAdminController::class, 'reorderCategories']);
            Route::post('/reorder/entries', [PhonebookAdminController::class, 'reorderEntries']);
        });
    });
});

// User settings API endpoint
Route::post('/api/user/settings', function (
    Request $request,
    UserSettingsService $settings,
) {
    if (strlen($request->getContent()) > 65_536) {
        return response()->json(['message' => 'The settings document is too large.'], 422);
    }

    $validated = $request->validate([
        'settings' => ['required', 'array'],
    ]);
    $mergedSettings = $settings->merge($request->user(), $validated['settings']);

    return response()->json(['status' => 'ok', 'settings' => $mergedSettings]);
})->middleware(['auth', EnsureUserIsActive::class, 'throttle:60,1']);

Route::get('/dev/impersonate/{role}', [DevController::class, 'impersonate'])
    ->name('dev.impersonate')
    ->middleware(AutoLoginDevUser::class);
