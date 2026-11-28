<?php

namespace App\Mcp\Tools\Public;

use App\Services\Ministries\MinistryDirectoryService;
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

#[Name('list-ministries')]
#[Title('List Syrian Ministries & Sovereign Bodies')]
#[Description(
    'List Syrian ministries, historical merged/split portfolios, and sovereign bodies, '
    .'or inspect a single ministry by slug.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListMinistriesTool extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'slug' => $schema->string()
                ->description('Optional ministry slug to retrieve full detail for one ministry.'),

            'kind' => $schema->string()
                ->enum(['ministry', 'sovereign'])
                ->description('Optional filter: ministry or sovereign.'),

            'status' => $schema->string()
                ->description('Optional status filter (e.g. current, historical, merged).'),

            'q' => $schema->string()
                ->description('Optional Arabic or English search text.'),
        ];
    }

    public function handle(Request $request): Response|ResponseFactory
    {
        try {
            $validated = $request->validate([
                'slug' => 'sometimes|nullable|string|max:120',
                'kind' => 'sometimes|nullable|in:ministry,sovereign',
                'status' => 'sometimes|nullable|string|max:64',
                'q' => 'sometimes|nullable|string|max:120',
            ]);
        } catch (ValidationException $e) {
            return Response::error(implode(' ', collect($e->errors())->flatten()->all()));
        }

        $service = app(MinistryDirectoryService::class);
        $slug = trim((string) ($validated['slug'] ?? ''));

        if ($slug !== '') {
            $detail = $service->showPayload($slug);
            if ($detail === null) {
                return Response::error("Ministry '{$slug}' was not found.");
            }

            return Response::structured($detail);
        }

        $index = $service->indexPayload();
        $list = is_array($index['all_ministries'] ?? null) ? $index['all_ministries'] : [];

        $kind = trim((string) ($validated['kind'] ?? ''));
        $status = trim((string) ($validated['status'] ?? ''));
        $query = trim((string) ($validated['q'] ?? ''));

        if ($kind !== '') {
            $list = array_values(array_filter($list, fn (array $m): bool => (string) ($m['kind'] ?? '') === $kind));
        }

        if ($status !== '') {
            $list = array_values(array_filter($list, fn (array $m): bool => (string) ($m['status'] ?? '') === $status));
        }

        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $list = array_values(array_filter($list, function (array $m) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($m['slug'] ?? ''),
                    (string) ($m['name_ar'] ?? ''),
                    (string) ($m['name_en'] ?? ''),
                    (string) ($m['current_minister']['name_ar'] ?? ''),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        return Response::structured([
            'count' => count($list),
            'stats' => $index['stats'] ?? [],
            'ministries' => $list,
        ]);
    }
}
