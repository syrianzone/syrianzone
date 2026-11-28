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
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('create-guesswho-character')]
#[Title('Create Guess Who Character')]
#[Description(
    'Create a new character in the Guess Who game under an existing category. '
    .'Call list-guesswho-categories first to obtain a valid category_id.'
)]
#[IsDestructive]
class CreateGuessWhoCharacterTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::GUESSWHO_MANAGE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'category_id' => $schema->integer()
                ->description('Guess Who category id (from list-guesswho-categories).')
                ->min(1)
                ->required(),

            'name_ar' => $schema->string()
                ->description('Arabic character name. Required.')
                ->required(),

            'name_en' => $schema->string()
                ->description('English character name. Required.')
                ->required(),

            'image_path' => $schema->string()
                ->description('Optional relative storage path or image URL for the character portrait.'),

            'attributes' => $schema->object()
                ->description('Optional structured trait/attribute map for the character.'),

            'is_active' => $schema->boolean()
                ->description('Whether the character is active in games.')
                ->default(true),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'category_id' => 'required|integer|exists:guess_who_categories,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'required|string|max:255',
            'image_path' => ['sometimes', 'nullable', 'string', 'max:1024', 'regex:/^guesswho\/(?!.*\.\.)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/'],
            'attributes' => 'sometimes|nullable|array',
            'is_active' => 'sometimes|boolean',
        ]);

        $character = GuessWhoCharacter::create([
            'category_id' => $validated['category_id'],
            'name_ar' => $validated['name_ar'],
            'name_en' => $validated['name_en'],
            'image_path' => $validated['image_path'] ?? '',
            'attributes' => $validated['attributes'] ?? null,
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        $character->load('category:id,name_ar');

        return Response::structured([
            'created' => true,
            'character' => [
                'id' => $character->id,
                'category_id' => $character->category_id,
                'category_name_ar' => $character->category?->name_ar,
                'name_ar' => $character->name_ar,
                'name_en' => $character->name_en,
                'image_path' => $character->image_path,
                'attributes' => $character->attributes,
                'is_active' => (bool) $character->is_active,
            ],
        ]);
    }
}
