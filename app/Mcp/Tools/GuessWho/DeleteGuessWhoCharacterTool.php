<?php

namespace App\Mcp\Tools\GuessWho;

use App\Mcp\Tools\AuditedTool;
use App\Models\GuessWhoCharacter;
use App\Models\GuessWhoGame;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('delete-guesswho-character')]
#[Title('Delete Guess Who Character')]
#[Description(
    'Permanently delete a Guess Who character by id, clearing references in existing games and '
    .'removing its uploaded image if unused. To disable without deleting, use update-guesswho-character with is_active=false.'
)]
#[IsDestructive]
class DeleteGuessWhoCharacterTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::GUESSWHO_MANAGE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->integer()
                ->description('Numeric id of the character to delete permanently.')
                ->min(1)
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|integer|min:1',
        ]);

        $character = GuessWhoCharacter::find($validated['id']);
        if ($character === null) {
            return Response::error("Guess Who character #{$validated['id']} was not found. Call list-guesswho-characters to see valid ids.");
        }

        $imagePath = $character->image_path;

        DB::transaction(function () use ($character): void {
            GuessWhoGame::where('player_1_character_id', $character->id)
                ->update(['player_1_character_id' => null]);
            GuessWhoGame::where('player_2_character_id', $character->id)
                ->update(['player_2_character_id' => null]);
            $character->delete();
        });

        if ($imagePath && str_starts_with($imagePath, 'guesswho/') && ! GuessWhoCharacter::where('image_path', $imagePath)->exists()) {
            try {
                if (Storage::disk('public')->exists($imagePath)) {
                    Storage::disk('public')->delete($imagePath);
                }
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return Response::structured([
            'deleted' => true,
            'id' => (int) $validated['id'],
        ]);
    }
}
