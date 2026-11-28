<?php

namespace App\Mcp\Tools\Phonebook;

use App\Exceptions\Directories\DirectoryActionException;
use App\Mcp\Tools\AuditedTool;
use App\Services\Phonebook\PhonebookDirectoryService;
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

#[Name('delete-phonebook-entry')]
#[Title('Delete Phonebook Entry')]
#[Description(
    'Permanently delete a phonebook entry by id. This is a hard delete and cannot be undone. '
    .'To hide an entry while keeping its data, use update-phonebook-entry with is_active=false instead.'
)]
#[IsDestructive]
class DeletePhonebookEntryTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::PHONEBOOK_DELETE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the phonebook entry to delete permanently.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128',
        ]);

        try {
            app(PhonebookDirectoryService::class)->deleteEntry($validated['id']);

            return Response::structured([
                'deleted' => true,
                'id' => $validated['id'],
            ]);
        } catch (DirectoryActionException $e) {
            return Response::error($e->getMessage().' Call list-phonebook-entries to see valid ids.');
        }
    }
}
