<?php

namespace App\Mcp\Tools\Wildlife;

use App\Models\WildlifeSpecies;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-wildlife-species')]
#[Title('List Wildlife Species')]
#[Description(
    'List the species of the wildlife guide (/wild) in display order, drafts and hidden species included, with '
    .'each one\'s state (draft = never published, published, hidden), whether it has a pending draft, and its '
    .'version. The entry point for the module; call get-wildlife-species for a full record.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListWildlifeSpeciesTool extends WildlifeTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return [
            'state' => $schema->string()->enum(['draft', 'published', 'hidden'])
                ->description('Only species in this state.'),
            'has_draft' => $schema->boolean()->description('When true, only species with an edit waiting to be published.'),
            'group' => $schema->string()->enum(['mammal', 'bird', 'reptile', 'amphibian', 'fish', 'invertebrate']),
            'query' => $schema->string()->description('Matches the slug, Arabic, English or scientific name.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'state' => 'sometimes|in:draft,published,hidden',
            'has_draft' => 'sometimes|boolean',
            'group' => 'sometimes|string',
            'query' => 'sometimes|string|max:100',
        ]);

        $items = WildlifeSpecies::query()->orderBy('position')->orderBy('id')->get()
            ->map(fn (WildlifeSpecies $s) => $this->summary($s))
            ->filter(function (array $s) use ($validated) {
                if (isset($validated['state']) && $s['state'] !== $validated['state']) {
                    return false;
                }
                if (isset($validated['has_draft']) && $s['has_draft'] !== (bool) $validated['has_draft']) {
                    return false;
                }
                if (isset($validated['group']) && $s['group'] !== $validated['group']) {
                    return false;
                }
                $q = mb_strtolower(trim((string) ($validated['query'] ?? '')));

                return $q === '' || str_contains(mb_strtolower(implode(' ', [$s['slug'], $s['name_ar'], $s['name_en'], $s['scientific']])), $q);
            })
            ->values();

        return Response::structured(['count' => $items->count(), 'species' => $items->all()]);
    }
}
