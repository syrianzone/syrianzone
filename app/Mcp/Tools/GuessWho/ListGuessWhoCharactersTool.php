<?php

namespace App\Mcp\Tools\GuessWho;

use App\Mcp\Tools\AuditedTool;
use App\Models\GuessWhoCharacter;
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

#[Name('list-guesswho-characters')]
#[Title('List Guess Who Characters')]
#[Description(
    'List characters in the Guess Who game, optionally filtered by category_id or active status.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListGuessWhoCharactersTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::GUESSWHO_MANAGE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'category_id' => $schema->integer()
                ->description('Restrict to one Guess Who category id (from list-guesswho-categories).')
                ->min(1),

            'only_active' => $schema->boolean()
                ->description('When true, return only active characters.')
                ->default(false),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'characters' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->integer(),
                    'category_id' => $schema->integer(),
                    'category_name_ar' => $schema->string()->nullable(),
                    'name_ar' => $schema->string(),
                    'name_en' => $schema->string()->nullable(),
                    'image_path' => $schema->string()->nullable(),
                    'is_active' => $schema->boolean(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'category_id' => 'sometimes|integer|min:1',
            'only_active' => 'sometimes|boolean',
        ]);

        $characters = GuessWhoCharacter::query()
            ->with('category:id,name_ar')
            ->when(isset($validated['category_id']), fn ($q) => $q->where('category_id', $validated['category_id']))
            ->when(($validated['only_active'] ?? false) === true, fn ($q) => $q->where('is_active', true))
            ->orderBy('id')
            ->get();

        return Response::structured([
            'count' => $characters->count(),
            'characters' => $characters->map(fn (GuessWhoCharacter $char) => [
                'id' => $char->id,
                'category_id' => $char->category_id,
                'category_name_ar' => $char->category?->name_ar,
                'name_ar' => $char->name_ar,
                'name_en' => $char->name_en,
                'image_path' => $char->image_path,
                'is_active' => (bool) $char->is_active,
            ])->all(),
        ]);
    }
}
