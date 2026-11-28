<?php

namespace App\Mcp\Tools\Public;

use App\Services\Wildlife\WildlifeData;
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

#[Name('list-wildlife')]
#[Title('List Syrian Wildlife Species')]
#[Description(
    'List documented Syrian wildlife species from the public wildlife guide (/wild), '
    .'or retrieve a single species profile by slug.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListWildlifeTool extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'slug' => $schema->string()
                ->description('Optional species slug to retrieve full detail for one species.'),

            'q' => $schema->string()
                ->description('Optional Arabic, English, or scientific name search text.'),

            'group' => $schema->string()
                ->description('Optional taxonomic group filter.'),

            'status' => $schema->string()
                ->description('Optional IUCN conservation status filter.'),

            'limit' => $schema->integer()
                ->description('Maximum species to return (1-200, default 50).')
                ->min(1)
                ->max(200)
                ->default(50),
        ];
    }

    public function handle(Request $request): Response|ResponseFactory
    {
        try {
            $validated = $request->validate([
                'slug' => 'sometimes|nullable|string|max:120',
                'q' => 'sometimes|nullable|string|max:120',
                'group' => 'sometimes|nullable|string|max:64',
                'status' => 'sometimes|nullable|string|max:32',
                'limit' => 'sometimes|integer|min:1|max:200',
            ]);
        } catch (ValidationException $e) {
            return Response::error(implode(' ', collect($e->errors())->flatten()->all()));
        }

        $service = app(WildlifeData::class);
        $slug = trim((string) ($validated['slug'] ?? ''));

        if ($slug !== '') {
            $detail = $service->forSpecies($slug);
            if ($detail === null) {
                return Response::error("Wildlife species '{$slug}' was not found.");
            }

            return Response::structured($detail);
        }

        $hub = $service->forHub();
        $species = is_array($hub['species'] ?? null) ? $hub['species'] : [];

        $query = trim((string) ($validated['q'] ?? ''));
        $group = trim((string) ($validated['group'] ?? ''));
        $status = trim((string) ($validated['status'] ?? ''));
        $limit = (int) ($validated['limit'] ?? 50);

        $filtered = $species;

        if ($group !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $s): bool => (string) ($s['group'] ?? $s['taxon_group'] ?? '') === $group,
            ));
        }

        if ($status !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $s): bool => (string) ($s['iucn_status'] ?? $s['status'] ?? '') === $status,
            ));
        }

        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $filtered = array_values(array_filter($filtered, function (array $s) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($s['slug'] ?? ''),
                    (string) ($s['name_ar'] ?? ''),
                    (string) ($s['name_en'] ?? ''),
                    (string) ($s['scientific_name'] ?? ''),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        $sliced = array_slice($filtered, 0, $limit);

        return Response::structured([
            'total' => count($filtered),
            'count' => count($sliced),
            'species' => $sliced,
        ]);
    }
}
