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

#[Name('update-guesswho-character')]
#[Title('Update Guess Who Character')]
#[Description(
    'Update an existing Guess Who character by id. Only the fields you pass are modified; '
    .'call list-guesswho-characters first to inspect valid ids.'
)]
#[IsDestructive]
class UpdateGuessWhoCharacterTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::GUESSWHO_MANAGE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->integer()
                ->description('Numeric id of the character to update.')
                ->min(1)
                ->required(),

            'category_id' => $schema->integer()
                ->description('Optional new category id (from list-guesswho-categories).')
                ->min(1),

            'name_ar' => $schema->string()
                ->description('Optional new Arabic character name.'),

            'name_en' => $schema->string()
                ->description('Optional new English character name.'),

            'image_path' => $schema->string()
                ->description('Optional new relative storage path or image URL.'),

            'attributes' => $schema->object()
                ->description('Optional replacement attribute map.'),

            'is_active' => $schema->boolean()
                ->description('Optional active toggle.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $id = (int) $request->get('id', 0);
        $character = $id > 0 ? GuessWhoCharacter::find($id) : null;

        if ($character === null) {
            return Response::error("Guess Who character #{$id} was not found. Call list-guesswho-characters to see valid ids.");
        }

        $validated = $request->validate([
            'id' => 'required|integer|min:1',
            'category_id' => 'sometimes|integer|exists:guess_who_categories,id',
            'name_ar' => 'sometimes|string|max:255',
            'name_en' => 'sometimes|string|max:255',
            'image_path' => 'sometimes|nullable|string|max:1024',
            'attributes' => 'sometimes|nullable|array',
            'is_active' => 'sometimes|boolean',
        ]);

        $updates = collect($validated)->except('id')->all();
        if ($updates === []) {
            return Response::error('Provide at least one field to update.');
        }

        $character->update($updates);
        $character->load('category:id,name_ar');

        return Response::structured([
            'updated' => true,
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
