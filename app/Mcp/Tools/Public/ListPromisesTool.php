<?php

namespace App\Mcp\Tools\Public;

use App\Services\Promises\PromisePresenter;
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

#[Name('list-promises')]
#[Title('List Published Public Promises')]
#[Description(
    'List published promises in the Syrian promises tracker (عداد الوعود), with speaker, deadline, '
    .'status, sector, and aggregate public vote counts. Filter optionally by q, state, sector, or governorate.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListPromisesTool extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'q' => $schema->string()
                ->description('Optional Arabic or English search text.'),

            'state' => $schema->string()
                ->description('Optional display state or status filter (e.g. in_progress, fulfilled, broken, overdue).'),

            'sector' => $schema->string()
                ->description('Optional sector slug or id filter.'),

            'governorate' => $schema->string()
                ->description('Optional governorate id filter (e.g. damascus, aleppo).'),

            'limit' => $schema->integer()
                ->description('Maximum promises to return (1-100, default 30).')
                ->min(1)
                ->max(100)
                ->default(30),
        ];
    }

    public function handle(Request $request): Response|ResponseFactory
    {
        try {
            $validated = $request->validate([
                'q' => 'sometimes|nullable|string|max:120',
                'state' => 'sometimes|nullable|string|max:64',
                'sector' => 'sometimes|nullable|string|max:64',
                'governorate' => 'sometimes|nullable|string|max:64',
                'limit' => 'sometimes|integer|min:1|max:100',
            ]);
        } catch (ValidationException $e) {
            return Response::error(implode(' ', collect($e->errors())->flatten()->all()));
        }

        $index = app(PromisePresenter::class)->index();
        $promises = is_array($index['promises'] ?? null) ? $index['promises'] : [];

        $query = trim((string) ($validated['q'] ?? ''));
        $state = trim((string) ($validated['state'] ?? ''));
        $sector = trim((string) ($validated['sector'] ?? ''));
        $governorate = trim((string) ($validated['governorate'] ?? ''));
        $limit = (int) ($validated['limit'] ?? 30);

        $filtered = $promises;

        if ($state !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $p): bool => (string) ($p['displayState'] ?? $p['status'] ?? '') === $state
                    || (string) ($p['status'] ?? '') === $state,
            ));
        }

        if ($sector !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $p): bool => (string) ($p['sector']['slug'] ?? $p['sector']['id'] ?? '') === $sector,
            ));
        }

        if ($governorate !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $p): bool => in_array($governorate, (array) ($p['governorates'] ?? []), true),
            ));
        }

        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $filtered = array_values(array_filter($filtered, function (array $p) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($p['number'] ?? ''),
                    (string) ($p['title'] ?? ''),
                    (string) ($p['speaker']['name'] ?? ''),
                    (string) ($p['institution']['name'] ?? ''),
                    (string) ($p['sector']['name'] ?? ''),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        $sliced = array_slice($filtered, 0, $limit);

        return Response::structured([
            'total' => count($filtered),
            'count' => count($sliced),
            'stats' => $index['stats'] ?? [],
            'promises' => $sliced,
        ]);
    }
}
