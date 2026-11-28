<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompassFigure;
use App\Models\CompassPersona;
use App\Support\Compass\CompassStats;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Public read-only JSON API for the Syrian Political Compass (aggregate stats & config).
 */
class CompassPublicApiController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $stats = Cache::remember(
            CompassStats::PUBLIC_CACHE_KEY,
            now()->addMinutes(10),
            fn () => CompassStats::aggregateAnonymous(),
        );

        $personas = CompassPersona::query()
            ->orderBy('sort_order')
            ->get(['slug', 'name'])
            ->map(fn (CompassPersona $p) => ['id' => $p->slug, 'name' => $p->name])
            ->all();

        $payload = [
            'data' => [
                'stats' => $stats,
                'personas' => $personas,
            ],
            'meta' => [
                'personas_count' => count($personas),
            ],
        ];

        return $this->cachedJson($request, $payload, 300);
    }

    public function config(Request $request): JsonResponse
    {
        $figures = CompassFigure::query()
            ->where('enabled', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map->toFigurePayload()
            ->all();

        $personas = CompassPersona::query()
            ->where('enabled', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map->toPersonaPayload()
            ->all();

        $payload = [
            'data' => [
                'figures' => $figures,
                'personas' => $personas,
                'categories' => CompassFigure::CATEGORIES,
                'axes' => CompassStats::AXIS_IDS,
            ],
            'meta' => [
                'figures_count' => count($figures),
                'personas_count' => count($personas),
            ],
        ];

        return $this->cachedJson($request, $payload, 300);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function cachedJson(Request $request, array $payload, int $maxAge): JsonResponse
    {
        $etag = '"'.sha1((string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)).'"';
        $headers = [
            'Cache-Control' => "public, max-age={$maxAge}",
            'ETag' => $etag,
        ];

        if ($request->header('If-None-Match') === $etag) {
            return response()->json(null, 304, $headers);
        }

        return response()->json($payload, 200, $headers);
    }
}
