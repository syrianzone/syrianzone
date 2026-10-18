<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AppIconController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $store = $request->query('store');

        if ($store === 'apple') {
            $id = $request->query('id');
            if (! $id || ! ctype_digit((string) $id)) {
                return response()->json([
                    'message' => 'Invalid or missing Apple store id.',
                    'icon' => null,
                ], 400);
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
            if (! $package || ! preg_match('/^[a-zA-Z0-9._]+$/', (string) $package)) {
                return response()->json([
                    'message' => 'Invalid or missing Google Play package.',
                    'icon' => null,
                ], 400);
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

        return response()->json([
            'message' => 'Unsupported store.',
            'icon' => null,
        ], 400);
    }
}
