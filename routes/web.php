<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\AuthController;

use App\Http\Controllers\HomeController;

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
Route::get('/shawarma', function () {
    return Inertia::render('Shawarma/Index');
});
Route::get('/syid', [ExternalDataController::class, 'syid']);
Route::get('/syrian-contributors', [ExternalDataController::class, 'contributors']);
Route::get('/sites', [ExternalDataController::class, 'sites']);
Route::get('/party', [ExternalDataController::class, 'party']);
Route::get('/house', [ExternalDataController::class, 'house']);
Route::get('/alignment', [ExternalDataController::class, 'alignment']);
Route::get('/govapps', [ExternalDataController::class, 'govapps']);
Route::get('/population', [PopulationAtlasController::class, 'renderIndex']);

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
    
    $routesPath = public_path("data/{$id}/routes.geojson");
    $stopsPath = public_path("data/{$id}/stops.geojson");
    
    $routeData = null;
    $stopsData = [];
    
    if (file_exists($routesPath)) {
        $routesGeoJson = json_decode(file_get_contents($routesPath), true);
        if (isset($routesGeoJson['features'])) {
            foreach ($routesGeoJson['features'] as $feature) {
                if (isset($feature['properties']['id']) && $feature['properties']['id'] === $routeId) {
                    $routeData = $feature['properties'];
                    break;
                }
            }
        }
    }
    
    if (file_exists($stopsPath)) {
        $stopsGeoJson = json_decode(file_get_contents($stopsPath), true);
        if (isset($stopsGeoJson['features'])) {
            foreach ($stopsGeoJson['features'] as $feature) {
                if (isset($feature['properties']['routeId']) && $feature['properties']['routeId'] === $routeId) {
                    $stopsData[] = [
                        'properties' => $feature['properties'],
                        'coordinates' => $feature['geometry']['coordinates'] ?? [0, 0]
                    ];
                }
            }
        }
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


