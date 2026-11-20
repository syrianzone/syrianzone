<?php

namespace App\Mcp\Tools\Phonebook;

use App\Mcp\Tools\AuditedTool;
use App\Models\PhonebookCategory;
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

#[Name('list-phonebook-categories')]
#[Title('List Phonebook Categories')]
#[Description(
    'List the categories in the Syrian emergency and service phonebook directory in display order, '
    .'with Arabic/English labels, icons, and active flags.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListPhonebookCategoriesTool extends AuditedTool
{
    public function __construct()
    {
        $this->anyPermissions = PermissionCatalogue::forModule('phonebook');
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'only_active' => $schema->boolean()
                ->description('When true, return only categories visible on the public site.')
                ->default(false),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'categories' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->string(),
                    'label_ar' => $schema->string(),
                    'label_en' => $schema->string()->nullable(),
                    'icon' => $schema->string()->nullable(),
                    'order_column' => $schema->integer(),
                    'is_active' => $schema->boolean(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'only_active' => 'sometimes|boolean',
        ]);

        $categories = app(PhonebookDirectoryService::class)->categories()
            ->when(
                ($validated['only_active'] ?? false) === true,
                fn ($c) => $c->where('is_active', true),
            )
            ->values();

        return Response::structured([
            'count' => $categories->count(),
            'categories' => $categories->map(fn (PhonebookCategory $cat) => [
                'id' => $cat->id,
                'label_ar' => $cat->label_ar,
                'label_en' => $cat->label_en,
                'icon' => $cat->icon,
                'order_column' => (int) $cat->order_column,
                'is_active' => (bool) $cat->is_active,
            ])->all(),
        ]);
    }
}
