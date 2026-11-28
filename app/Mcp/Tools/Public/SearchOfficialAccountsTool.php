<?php

namespace App\Mcp\Tools\Public;

use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Services\SyOfficial\SyOfficialPresenter;
use App\Support\ArabicSearch;
use Illuminate\Contracts\JsonSchema\JsonSchema;
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

#[Name('search-official-accounts')]
#[Title('Search Official Syrian Accounts')]
#[Description(
    'Search verified official Syrian government and public institution accounts (SyOfficial directory). '
    .'Returns official social links, descriptions, and categories.'
)]
#[IsReadOnly]
#[IsIdempotent]
class SearchOfficialAccountsTool extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'q' => $schema->string()
                ->description('Optional Arabic or English search text (matches entity name, slug, or description).'),

            'category_id' => $schema->string()
                ->description('Optional SyOfficial category id to filter by.'),

            'limit' => $schema->integer()
                ->description('Maximum entities to return (1-200, default 50).')
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

        $categories = SyOfficialDirectoryService::publicCategories();
        $entities = SyOfficialDirectoryService::publicEntities(app(SyOfficialPresenter::class));

        $categoryId = trim((string) ($validated['category_id'] ?? ''));
        $query = trim((string) ($validated['q'] ?? ''));
        $limit = (int) ($validated['limit'] ?? 50);

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
            'entities' => $sliced,
        ]);
    }
}
