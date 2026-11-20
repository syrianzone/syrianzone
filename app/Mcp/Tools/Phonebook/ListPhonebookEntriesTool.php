<?php

namespace App\Mcp\Tools\Phonebook;

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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-phonebook-entries')]
#[Title('List Phonebook Entries')]
#[Description(
    'List phone and WhatsApp service entries in the Syrian phonebook directory in display order, '
    .'with category, Arabic/English names, numbers, WhatsApp flag, source URL, and active state. '
    .'Filter by category_id to inspect one category at a time.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListPhonebookEntriesTool extends AuditedTool
{
    public function __construct()
    {
        $this->anyPermissions = PermissionCatalogue::forModule('phonebook');
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'category_id' => $schema->string()
                ->description('Restrict to one phonebook category. Get valid ids from list-phonebook-categories.'),

            'only_active' => $schema->boolean()
                ->description('When true, return only entries visible on the public site.')
                ->default(false),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'entries' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->string(),
                    'category_id' => $schema->string(),
                    'category_label_ar' => $schema->string()->nullable(),
                    'name_ar' => $schema->string(),
                    'name_en' => $schema->string()->nullable(),
                    'number' => $schema->string(),
                    'is_whatsapp' => $schema->boolean(),
                    'source_url' => $schema->string()->nullable(),
                    'order_column' => $schema->integer(),
                    'is_active' => $schema->boolean(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'category_id' => 'sometimes|string|max:64',
            'only_active' => 'sometimes|boolean',
        ]);

        $entries = app(PhonebookDirectoryService::class)->entries()
            ->when(
                isset($validated['category_id']),
                fn ($c) => $c->where('category_id', $validated['category_id']),
            )
            ->when(
                ($validated['only_active'] ?? false) === true,
                fn ($c) => $c->where('is_active', true),
            )
            ->values();

        return Response::structured([
            'count' => $entries->count(),
            'entries' => $entries->map(fn (PhonebookEntry $entry) => [
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
            ])->all(),
        ]);
    }
}
