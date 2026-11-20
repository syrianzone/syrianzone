<?php

namespace App\Mcp\Tools\GuessWho;

use App\Mcp\Tools\AuditedTool;
use App\Models\GuessWhoCategory;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-guesswho-categories')]
#[Title('List Guess Who Categories')]
#[Description(
    'List character categories for the Guess Who game, including Arabic/English names, slug, '
    .'active flag, and character count.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListGuessWhoCategoriesTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::GUESSWHO_MANAGE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'only_active' => $schema->boolean()
                ->description('When true, return only active categories.')
                ->default(false),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'categories' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->integer(),
                    'name_ar' => $schema->string(),
                    'name_en' => $schema->string(),
                    'slug' => $schema->string(),
                    'is_active' => $schema->boolean(),
                    'characters_count' => $schema->integer(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'only_active' => 'sometimes|boolean',
        ]);

        $categories = GuessWhoCategory::query()
            ->withCount('characters')
            ->when(($validated['only_active'] ?? false) === true, fn ($q) => $q->where('is_active', true))
            ->orderBy('id')
            ->get();

        return Response::structured([
            'count' => $categories->count(),
            'categories' => $categories->map(fn (GuessWhoCategory $cat) => [
                'id' => $cat->id,
                'name_ar' => $cat->name_ar,
                'name_en' => $cat->name_en,
                'slug' => $cat->slug,
                'is_active' => (bool) $cat->is_active,
                'characters_count' => (int) ($cat->characters_count ?? 0),
            ])->all(),
        ]);
    }
}
