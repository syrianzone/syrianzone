<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Services\Phonebook\PhonebookCache;
use App\Support\ArabicSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Public read-only JSON API for the Syrian phonebook directory.
 */
class PhonebookApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $categoryId = trim((string) $request->query('category_id', ''));
        $query = mb_substr(trim((string) $request->query('q', '')), 0, 120);

        $categories = Cache::remember(PhonebookCache::CATEGORIES_KEY, 600, function () {
            return PhonebookCategory::where('is_active', true)
                ->orderBy('order_column')
                ->get();
        });

        $entries = Cache::remember(PhonebookCache::ENTRIES_KEY, 600, function () {
            return PhonebookEntry::with('category')
                ->where('is_active', true)
                ->whereHas('category', fn ($q) => $q->where('is_active', true))
                ->orderBy('order_column')
                ->get()
                ->map(fn (PhonebookEntry $item) => [
                    'id' => $item->id,
                    'category_id' => $item->category_id,
                    'category_ar' => $item->category?->label_ar ?? '',
                    'category_en' => $item->category?->label_en ?? '',
                    'name_ar' => $item->name_ar,
                    'name_en' => $item->name_en ?? '',
                    'number' => $item->number,
                    'is_whatsapp' => (bool) $item->is_whatsapp,
                    'source_url' => $item->source_url ?? '',
                ])
                ->all();
        });

        $filtered = $entries;

        if ($categoryId !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $item): bool => (string) ($item['category_id'] ?? '') === $categoryId,
            ));
        }

        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $filtered = array_values(array_filter($filtered, function (array $item) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($item['name_ar'] ?? ''),
                    (string) ($item['name_en'] ?? ''),
                    (string) ($item['number'] ?? ''),
                    (string) ($item['category_ar'] ?? ''),
                    (string) ($item['category_en'] ?? ''),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        $categoryPayload = collect($categories)->map(fn ($cat) => [
            'id' => $cat->id,
            'label_ar' => $cat->label_ar,
            'label_en' => $cat->label_en,
            'icon' => $cat->icon,
            'order_column' => (int) $cat->order_column,
        ])->values()->all();

        $payload = [
            'data' => [
                'categories' => $categoryPayload,
                'entries' => $filtered,
            ],
            'meta' => [
                'categories_count' => count($categoryPayload),
                'entries_count' => count($filtered),
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
