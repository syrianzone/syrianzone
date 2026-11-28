<?php

namespace App\Mcp\Tools\Public;

use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Services\Phonebook\PhonebookCache;
use App\Support\ArabicSearch;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('search-phonebook')]
#[Title('Search Syrian Phonebook')]
#[Description(
    'Search active public emergency, civic service, and WhatsApp numbers in the Syrian phonebook directory. '
    .'Filter optionally by category_id or Arabic/English search query q.'
)]
#[IsReadOnly]
#[IsIdempotent]
class SearchPhonebookTool extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'q' => $schema->string()
                ->description('Optional Arabic or English search text (matches name, number, or category).'),

            'category_id' => $schema->string()
                ->description('Optional phonebook category id to filter by.'),

            'limit' => $schema->integer()
                ->description('Maximum entries to return (1-200, default 50).')
                ->min(1)
                ->max(200)
                ->default(50),
        ];
    }

    public function handle(Request $request): Response|ResponseFactory
    {
        try {
            $validated = $request->validate([
                'q' => 'sometimes|nullable|string|max:120',
                'category_id' => 'sometimes|nullable|string|max:64',
                'limit' => 'sometimes|integer|min:1|max:200',
            ]);
        } catch (ValidationException $e) {
            return Response::error(implode(' ', collect($e->errors())->flatten()->all()));
        }

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

        $categoryId = trim((string) ($validated['category_id'] ?? ''));
        $query = trim((string) ($validated['q'] ?? ''));
        $limit = (int) ($validated['limit'] ?? 50);

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

        $total = count($filtered);
        $sliced = array_slice($filtered, 0, $limit);

        return Response::structured([
            'total' => $total,
            'count' => count($sliced),
            'categories' => collect($categories)->map(fn ($cat) => [
                'id' => $cat->id,
                'label_ar' => $cat->label_ar,
                'label_en' => $cat->label_en,
            ])->values()->all(),
            'entries' => $sliced,
        ]);
    }
}
