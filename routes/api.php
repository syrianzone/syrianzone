<?php

use App\Http\Controllers\Api\PopulationAtlasController;
use App\Http\Controllers\Api\V1\TransitController;
use App\Http\Controllers\ContributorController;
use App\Http\Controllers\MetricsController;
use App\Http\Controllers\PollController;
use App\Http\Controllers\TransitStudioController;
use App\Http\Middleware\ResolveOptionalMobileBearerToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

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

Route::get('/metrics', [MetricsController::class, 'index']);

Route::get('/app-icon', function (Request $request) {
    $store = $request->query('store');

    if ($store === 'apple') {
        $id = $request->query('id');
        if (! $id || ! ctype_digit($id)) {
            return response()->json(['icon' => null], 400);
        }

        $cacheKey = 'app_icon_apple_'.$id;
        $icon = cache()->remember($cacheKey, now()->addHours(24), function () use ($id) {
            $response = Http::timeout(10)->get('https://itunes.apple.com/lookup?id='.$id);
            if (! $response->successful()) {
                return null;
            }

            $data = $response->json();

            return $data['results'][0]['artworkUrl512'] ?? $data['results'][0]['artworkUrl100'] ?? null;
        });

        return response()->json(['icon' => $icon]);
    }

    if ($store === 'play') {
        $package = $request->query('package');
        if (! $package || ! preg_match('/^[a-zA-Z0-9._]+$/', $package)) {
            return response()->json(['icon' => null], 400);
        }

        $cacheKey = 'app_icon_play_'.$package;
        $icon = cache()->remember($cacheKey, now()->addHours(24), function () use ($package) {
            $response = Http::timeout(10)->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ])->get('https://play.google.com/store/apps/details?id='.$package.'&hl=en');

            if (! $response->successful()) {
                return null;
            }

            $html = $response->body();

            // Parse JSON-LD for icon
            if (preg_match('/<script type="application\/ld\+json">(.*?)<\/script>/s', $html, $matches)) {
                $json = json_decode($matches[1], true);
                if (! empty($json['image'])) {
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
    Route::get('/cities', [TransitController::class, 'getCities']);
    Route::get('/cities/{id}/routes', [TransitController::class, 'getRoutes']);
    Route::get('/cities/{id}/map-data', [TransitController::class, 'getMapData']);
    Route::get('/stops/nearby', [TransitController::class, 'getNearbyStops']);
    Route::get('/search', [TransitController::class, 'search']);

    // Transit Studio: open for community contributions
    Route::post('/studio/routes', [TransitStudioController::class, 'store'])
        ->middleware(ResolveOptionalMobileBearerToken::class)
        ->middleware('throttle:5,1');

});

require __DIR__.'/mobile-public.php';
require __DIR__.'/mobile-transit-admin.php';
require __DIR__.'/mobile-polls.php';
require __DIR__.'/mobile-account.php';
require __DIR__.'/mobile-guess-who.php';
require __DIR__.'/mobile-places.php';
