<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GovApp;
use App\Services\GovApps\GovAppPresenter;
use App\Services\GovApps\GovAppService;
use App\Support\ArabicSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Public read-only JSON API for the Syrian government apps directory.
 */
class GovAppsApiController extends Controller
{
    public function __construct(
        private readonly GovAppPresenter $presenter,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = mb_substr(trim((string) $request->query('q', '')), 0, 120);

        $apps = Cache::remember(GovAppService::APPS_CACHE_KEY, 600, function () {
            return $this->presenter->publicItems(
                GovApp::with('officialEntity')
                    ->where('is_active', true)
                    ->orderBy('order_column')
                    ->get()
            );
        });

        $filtered = $apps;
        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $filtered = array_values(array_filter($filtered, function (array $item) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($item['id'] ?? ''),
                    (string) ($item['name'] ?? ''),
                    (string) ($item['name_ar'] ?? ''),
                    (string) ($item['description'] ?? ''),
                    (string) ($item['description_ar'] ?? ''),
                    (string) ($item['category'] ?? ''),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        $payload = [
            'data' => $filtered,
            'meta' => [
                'count' => count($filtered),
                'filters' => [
                    'q' => $query !== '' ? $query : null,
                ],
            ],
        ];

        return $this->cachedJson($request, $payload, 300);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $app = GovApp::with('officialEntity')
            ->where('id', $id)
            ->where('is_active', true)
            ->firstOrFail();

        $related = GovApp::with('officialEntity')
            ->where('is_active', true)
            ->where('id', '!=', $app->id)
            ->orderByRaw('CASE WHEN official_entity_id IS NOT NULL AND official_entity_id = ? THEN 0 ELSE 1 END', [$app->official_entity_id ?? ''])
            ->orderBy('order_column')
            ->limit(4)
            ->get();

        $payload = [
            'data' => $this->presenter->publicDetail($app),
            'meta' => [
                'related' => $this->presenter->publicItems($related),
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
