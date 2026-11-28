<?php

namespace App\Mcp\Tools\Phonebook;

use App\Exceptions\Directories\DirectoryActionException;
use App\Mcp\Tools\AuditedTool;
use App\Models\PhonebookEntry;
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

#[Name('update-phonebook-entry')]
#[Title('Update Phonebook Entry')]
#[Description(
    'Update an existing phonebook entry by id. Only the fields you pass are modified; '
    .'omitted fields remain unchanged. Call list-phonebook-entries first to inspect valid ids.'
)]
#[IsDestructive]
class UpdatePhonebookEntryTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::PHONEBOOK_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the phonebook entry to update.')
                ->required(),

            'category_id' => $schema->string()
                ->description('Optional new category id (from list-phonebook-categories).'),

            'name_ar' => $schema->string()
                ->description('Optional new Arabic service name.'),

            'name_en' => $schema->string()
                ->description('Optional new English service name (empty string clears it).'),

            'number' => $schema->string()
                ->description('Optional new phone or WhatsApp number.'),

            'is_whatsapp' => $schema->boolean()
                ->description('Optional WhatsApp flag.'),

            'source_url' => $schema->string()
                ->description('Optional new verification source URL (empty string clears it).'),

            'is_active' => $schema->boolean()
                ->description('Optional visibility toggle.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128',
            'category_id' => 'sometimes|string|max:64|exists:phonebook_categories,id',
            'name_ar' => 'sometimes|string|max:255',
            'name_en' => 'sometimes|nullable|string|max:255',
            'number' => 'sometimes|string|max:64',
            'is_whatsapp' => 'sometimes|boolean',
            'source_url' => 'sometimes|nullable|url|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        $id = $validated['id'];
        $attributes = collect($validated)->except('id')->all();

        if ($attributes === []) {
            return Response::error('Provide at least one field to update.');
        }

        try {
            $entry = app(PhonebookDirectoryService::class)->updateEntry($id, $attributes);
            $entry->load('category');

            return Response::structured([
                'updated' => true,
                'entry' => $this->present($entry),
            ]);
        } catch (DirectoryActionException $e) {
            return Response::error($e->getMessage().' Call list-phonebook-entries to see valid ids.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function present(PhonebookEntry $entry): array
    {
        return [
            'id' => $entry->id,
            'category_id' => $entry->category_id,
            'category_label_ar' => $entry->category?->label_ar,
            'name_ar' => $entry->name_ar,
            'name_en' => $entry->name_en,
            'number' => $entry->number,
            'is_whatsapp' => (bool) $entry->is_whatsapp,
            'source_url' => $entry->source_url,
            'order_column' => (int) $entry->order_column,
            'is_active' => (bool) $entry->is_active,
        ];
    }
}
