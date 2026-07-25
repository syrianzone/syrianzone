<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\PollController;
use App\Http\Controllers\ContributorController;
use App\Http\Controllers\MetricsController;
use App\Http\Controllers\Api\PopulationAtlasController;

Route::get('/polls', [PollController::class, 'index']);
Route::get('/polls/{idOrSlug}', [PollController::class, 'show']);
Route::get('/polls/{idOrSlug}/leaderboard', [PollController::class, 'leaderboard']);

Route::middleware('throttle:voting')->group(function () {
    Route::post('/submit', [PollController::class, 'submit']);
});



Route::get('/contributors', [ContributorController::class, 'index']);
Route::get('/contributors/{contributor}', [ContributorController::class, 'show']);

Route::get('/population/master', [PopulationAtlasController::class, 'getData']);
Route::get('/population/env-report', [PopulationAtlasController::class, 'getEnvironmentalDetails']);



Route::get('/weather', [\App\Http\Controllers\WeatherController::class, 'show'])
    ->middleware('throttle:60,1');

Route::get('/answers', [\App\Http\Controllers\AnswersController::class, 'index'])
    ->middleware('throttle:60,1');

Route::get('/recipe-of-the-day', [\App\Http\Controllers\RecipeController::class, 'ofTheDay'])
    ->middleware('throttle:60,1');

Route::get('/events/today', [\App\Http\Controllers\EventsController::class, 'today'])
    ->middleware('throttle:60,1');

Route::get('/feed', [\App\Http\Controllers\FeedController::class, 'show'])
    ->middleware('throttle:60,1');

Route::get('/prayer-times', [\App\Http\Controllers\PrayerController::class, 'show'])
    ->middleware('throttle:60,1');

Route::get('/metrics', [MetricsController::class, 'index']);

Route::get('/app-icon', function (Request $request) {
    $store = $request->query('store');

    if ($store === 'apple') {
        $id = $request->query('id');
        if (!$id || !ctype_digit($id)) {
            return response()->json(['icon' => null], 400);
        }

        $cacheKey = 'app_icon_apple_' . $id;
        $icon = cache()->remember($cacheKey, now()->addHours(24), function () use ($id) {
            $response = \Illuminate\Support\Facades\Http::timeout(10)->get('https://itunes.apple.com/lookup?id=' . $id);
            if (!$response->successful()) {
                return null;
            }

            $data = $response->json();
            return $data['results'][0]['artworkUrl512'] ?? $data['results'][0]['artworkUrl100'] ?? null;
        });

        return response()->json(['icon' => $icon]);
    }

    if ($store === 'play') {
        $package = $request->query('package');
        if (!$package || !preg_match('/^[a-zA-Z0-9._]+$/', $package)) {
            return response()->json(['icon' => null], 400);
        }

        $cacheKey = 'app_icon_play_' . $package;
        $icon = cache()->remember($cacheKey, now()->addHours(24), function () use ($package) {
            $response = \Illuminate\Support\Facades\Http::timeout(10)->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ])->get('https://play.google.com/store/apps/details?id=' . $package . '&hl=en');

            if (!$response->successful()) {
                return null;
            }

            $html = $response->body();

            // Parse JSON-LD for icon
            if (preg_match('/<script type="application\/ld\+json">(.*?)<\/script>/s', $html, $matches)) {
                $json = json_decode($matches[1], true);
                if (!empty($json['image'])) {
                    return $json['image'];
                }
            }

            // Fallback: og:image meta
            if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']/', $html, $matches)) {
                return $matches[1];
            }

            return null;
        });

        return response()->json(['icon' => $icon]);
    }

    return response()->json(['icon' => null], 400);
});

Route::prefix('v1')->group(function () {
    Route::get('/cities', [\App\Http\Controllers\Api\V1\TransitController::class, 'getCities']);
    Route::get('/cities/{id}/routes', [\App\Http\Controllers\Api\V1\TransitController::class, 'getRoutes']);
    Route::get('/cities/{id}/map-data', [\App\Http\Controllers\Api\V1\TransitController::class, 'getMapData']);
    Route::get('/stops/nearby', [\App\Http\Controllers\Api\V1\TransitController::class, 'getNearbyStops']);
    Route::get('/search', [\App\Http\Controllers\Api\V1\TransitController::class, 'search']);

    // Transit Studio: open for community contributions
    Route::post('/studio/routes', [\App\Http\Controllers\TransitStudioController::class, 'store'])
        ->middleware('throttle:5,1');

    // Transit Studio: edit existing drafts (requires auth)
    Route::middleware('auth')->group(function () {
        Route::get('/studio/routes/{id}', [\App\Http\Controllers\TransitStudioController::class, 'show']);
        Route::put('/studio/routes/{id}', [\App\Http\Controllers\TransitStudioController::class, 'update'])
            ->middleware('throttle:10,1');
        Route::get('/studio/routes/{id}/from-route', [\App\Http\Controllers\TransitStudioController::class, 'showForEdit']);
    });

    // Hidden Places public reads. Throttled here only so the existing transit endpoints stay untouched.
    // Static /places/* paths must register before /places/{id}.
    Route::middleware('throttle:60,1')->group(function () {
        Route::get('/places/map', [\App\Http\Controllers\PlaceController::class, 'mapData']);
        Route::get('/places/nearby', [\App\Http\Controllers\PlaceController::class, 'nearby']);
        Route::get('/places/geocode', [\App\Http\Controllers\PlaceController::class, 'geocode']);
        Route::get('/places/photos', [\App\Http\Controllers\PlaceDiscoveryController::class, 'photos']);
        Route::get('/places', [\App\Http\Controllers\PlaceController::class, 'index']);
        Route::get('/guides', [\App\Http\Controllers\PlaceDiscoveryController::class, 'guides']);
        Route::get('/places/{id}', [\App\Http\Controllers\PlaceController::class, 'show'])->whereNumber('id');

        // HalaSyria hotels (cached in local DB, synced every 2 days)
        Route::get('/hotels/map', [\App\Http\Controllers\HotelController::class, 'mapData']);
        Route::get('/hotels', [\App\Http\Controllers\HotelController::class, 'index']);
        Route::get('/hotels/{id}', [\App\Http\Controllers\HotelController::class, 'show'])->whereNumber('id');
    });
});
