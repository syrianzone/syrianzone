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
});

Route::get('/transit/city/{id}/map', function ($id) {
    return Inertia::render('Transit/city/[id]/map/Index', ['id' => $id]);
});

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
});

Route::get('/transit/studio', function () {
    return Inertia::render('Transit/studio/Index');
});

Route::get('/transit/admin', function () {
    return Inertia::render('Transit/admin/Index');
})->middleware('auth');

Route::get('/user', [AuthController::class, 'user']);
Route::get('/auth/google', [AuthController::class, 'redirectToProvider'])->name('login');
Route::get('/auth/google/callback', [AuthController::class, 'handleProviderCallback']);
Route::post('/logout', [AuthController::class, 'logout']);

use App\Http\Controllers\AdminUserController;
Route::middleware('auth')->group(function () {
    // Polls Admin Routes
    Route::get('/admin/polls', [PollController::class, 'renderIndex']);
    Route::get('/admin/polls/create', [PollController::class, 'adminCreate']);
    Route::get('/admin/polls/{id}/edit', [PollController::class, 'adminEdit']);

    Route::get('/admins', [AdminUserController::class, 'index']);
    Route::post('/admins', [AdminUserController::class, 'store']);
    Route::delete('/admins/{id}', [AdminUserController::class, 'destroy']);

    Route::prefix('api')->group(function () {
        Route::get('/user', function (\Illuminate\Http\Request $request) {
            return $request->user();
        });

        Route::post('/polls', [PollController::class, 'store']);
        Route::put('/polls/{id}', [PollController::class, 'update']);
        Route::delete('/polls/{id}', [PollController::class, 'destroy']);

        Route::apiResource('candidate-groups', \App\Http\Controllers\CandidateGroupController::class);
        Route::post('/candidate-groups/reorder', [\App\Http\Controllers\CandidateGroupController::class, 'reorder']);
        Route::post('/candidate-groups/{id}/default', [\App\Http\Controllers\CandidateGroupController::class, 'setDefault']);

        Route::apiResource('candidates', \App\Http\Controllers\CandidateController::class)->except(['index', 'show']);
        Route::patch('/candidates/{id}/archive', [\App\Http\Controllers\CandidateController::class, 'archive']);
        Route::patch('/candidates/{id}/restore', [\App\Http\Controllers\CandidateController::class, 'restore']);

        Route::post('/sites', [\App\Http\Controllers\SiteController::class, 'store']);
        Route::put('/sites/{id}', [\App\Http\Controllers\SiteController::class, 'update']);
        Route::delete('/sites/{id}', [\App\Http\Controllers\SiteController::class, 'destroy']);

        Route::prefix('v1')->group(function () {
            Route::get('/admin/route-drafts', [\App\Http\Controllers\TransitAdminController::class, 'index']);
            Route::post('/admin/route-drafts/{id}/approve', [\App\Http\Controllers\TransitAdminController::class, 'approve']);
            Route::post('/admin/route-drafts/{id}/reject', [\App\Http\Controllers\TransitAdminController::class, 'reject']);
        });
    });
});

// Fallback for callback without api prefix (often configured in Google Console)
Route::get('/auth/google/callback', [AuthController::class, 'handleProviderCallback']);
