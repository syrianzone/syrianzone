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

#[Name('create-phonebook-entry')]
#[Title('Create Phonebook Entry')]
#[Description(
    'Create a new phone or WhatsApp service entry inside a phonebook category. '
    .'Call list-phonebook-categories first to obtain a valid category_id. '
    .'If id is omitted, a unique phone_* ULID is generated automatically.'
)]
#[IsDestructive]
class CreatePhonebookEntryTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::PHONEBOOK_CREATE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Optional permanent slug (alpha_dash, max 128). Omit to auto-generate a ULID.'),

            'category_id' => $schema->string()
                ->description('Phonebook category id. Get valid ids from list-phonebook-categories.')
                ->required(),

            'name_ar' => $schema->string()
                ->description('Arabic service name. Required.')
                ->required(),

            'name_en' => $schema->string()
                ->description('Optional English service name.'),

            'number' => $schema->string()
                ->description('Phone or WhatsApp number (max 64 chars). Required.')
                ->required(),

            'is_whatsapp' => $schema->boolean()
                ->description('Whether this number is a WhatsApp contact.')
                ->default(false),

            'source_url' => $schema->string()
                ->description('Optional HTTP(S) verification source URL.'),

            'is_active' => $schema->boolean()
                ->description('Whether the entry is visible on the public site.')
                ->default(true),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'sometimes|nullable|string|max:128|unique:phonebook_entries,id|alpha_dash',
            'category_id' => 'required|string|max:64|exists:phonebook_categories,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'sometimes|nullable|string|max:255',
            'number' => 'required|string|max:64',
            'is_whatsapp' => 'sometimes|boolean',
            'source_url' => 'sometimes|nullable|url|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        try {
            $entry = app(PhonebookDirectoryService::class)->createEntry($validated);
            $entry->load('category');

            return Response::structured([
                'created' => true,
                'entry' => $this->present($entry),
            ]);
        } catch (DirectoryActionException $e) {
            return Response::error($e->getMessage());
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
