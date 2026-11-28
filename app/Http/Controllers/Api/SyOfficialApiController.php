<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Services\SyOfficial\SyOfficialPresenter;
use App\Support\ArabicSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Public read-only JSON API for the SyOfficial directory of official accounts.
 */
class SyOfficialApiController extends Controller
{
    public function __construct(
        private readonly SyOfficialPresenter $presenter,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $categoryId = trim((string) $request->query('category_id', ''));
        $query = mb_substr(trim((string) $request->query('q', '')), 0, 120);

        $categories = Cache::remember(SyOfficialDirectoryService::CATEGORIES_CACHE_KEY, 600, function () {
            return OfficialCategory::where('is_active', true)
                ->orderBy('order_column')
                ->get();
        });

        $entities = Cache::remember(SyOfficialDirectoryService::ENTITIES_CACHE_KEY, 600, function () {
            return $this->presenter->publicEntities(
                OfficialEntity::with('category')
                    ->where('is_active', true)
                    ->whereHas('category', fn ($q) => $q->where('is_active', true))
                    ->orderBy('order_column')
                    ->get()
            );
        });

        $filtered = $entities;

        if ($categoryId !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $item): bool => (string) ($item['category'] ?? $item['category_id'] ?? '') === $categoryId,
            ));
        }

        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $filtered = array_values(array_filter($filtered, function (array $item) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($item['id'] ?? ''),
                    (string) ($item['name'] ?? ''),
                    (string) ($item['name_ar'] ?? ''),
                    (string) ($item['description'] ?? ''),
                    (string) ($item['description_ar'] ?? ''),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        $categoryPayload = collect($categories)->map(fn ($cat) => [
            'id' => $cat->id,
            'label_ar' => $cat->label_ar,
            'label_en' => $cat->label_en,
            'order_column' => (int) $cat->order_column,
        ])->values()->all();

        $payload = [
            'data' => [
                'categories' => $categoryPayload,
                'entities' => $filtered,
            ],
            'meta' => [
                'categories_count' => count($categoryPayload),
                'entities_count' => count($filtered),
                'filters' => [
                    'category_id' => $categoryId !== '' ? $categoryId : null,
                    'q' => $query !== '' ? $query : null,
                ],
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
