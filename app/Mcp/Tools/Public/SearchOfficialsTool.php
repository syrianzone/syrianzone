<?php

namespace App\Mcp\Tools\Public;

use App\Services\GovtCvs\GovtOfficialDirectory;
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

#[Name('search-officials')]
#[Title('Search Published Syrian Government Officials')]
#[Description(
    'Search published Syrian government officials, ministers, and governors in the Government CVs directory. '
    .'Returns public biography summaries, current/former offices, and links.'
)]
#[IsReadOnly]
#[IsIdempotent]
class SearchOfficialsTool extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'q' => $schema->string()
                ->description('Optional Arabic or English search query (name, role, or institution).'),

            'status' => $schema->string()
                ->description('Optional tenure status filter (e.g. current, former).'),

            'tier' => $schema->string()
                ->description('Optional office tier filter.'),

            'institution_id' => $schema->string()
                ->description('Optional institution id filter.'),

            'limit' => $schema->integer()
                ->description('Maximum officials to return (1-100, default 30).')
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
                'status' => 'sometimes|nullable|string|max:32',
                'tier' => 'sometimes|nullable|string|max:64',
                'institution_id' => 'sometimes|nullable|string|max:64',
                'limit' => 'sometimes|integer|min:1|max:100',
            ]);
        } catch (ValidationException $e) {
            return Response::error(implode(' ', collect($e->errors())->flatten()->all()));
        }

        $filters = array_filter([
            'q' => $validated['q'] ?? null,
            'status' => $validated['status'] ?? null,
            'tier' => $validated['tier'] ?? null,
            'institution_id' => $validated['institution_id'] ?? null,
        ], fn ($v) => is_string($v) && trim($v) !== '');

        $result = app(GovtOfficialDirectory::class)->index($filters, includeOptions: false, compact: true);
        $officials = is_array($result['officials'] ?? null) ? $result['officials'] : [];
        $limit = (int) ($validated['limit'] ?? 30);
        $sliced = array_slice($officials, 0, $limit);

        return Response::structured([
            'total' => count($officials),
            'count' => count($sliced),
            'stats' => $result['stats'] ?? [],
            'officials' => $sliced,
        ]);
    }
}
