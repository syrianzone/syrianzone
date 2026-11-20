<?php

namespace App\Mcp\Tools\Polls;

use App\Mcp\Tools\AuditedTool;
use App\Models\Poll;
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

#[Name('list-polls')]
#[Title('List Polls')]
#[Description(
    'List tier-list and community polls managed in the dashboard, including their slug, active status, '
    .'timezone, and candidate count.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListPollsTool extends AuditedTool
{
    public function __construct()
    {
        $this->anyPermissions = PermissionCatalogue::forModule('polls');
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'only_active' => $schema->boolean()
                ->description('When true, return only currently active polls.')
                ->default(false),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'polls' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->string(),
                    'slug' => $schema->string(),
                    'title' => $schema->string(),
                    'timezone' => $schema->string(),
                    'is_active' => $schema->boolean(),
                    'candidates_count' => $schema->integer(),
                    'updated_at' => $schema->string()->nullable(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'only_active' => 'sometimes|boolean',
        ]);

        $polls = Poll::query()
            ->withCount('candidates')
            ->when(
                ($validated['only_active'] ?? false) === true,
                fn ($q) => $q->where('is_active', true),
            )
            ->orderByDesc('created_at')
            ->get();

        return Response::structured([
            'count' => $polls->count(),
            'polls' => $polls->map(fn (Poll $poll) => [
                'id' => $poll->id,
                'slug' => $poll->slug,
                'title' => $poll->title,
                'timezone' => $poll->safeTimezone(),
                'is_active' => (bool) $poll->is_active,
                'candidates_count' => (int) ($poll->candidates_count ?? 0),
                'updated_at' => $poll->updated_at?->toIso8601String(),
            ])->all(),
        ]);
    }
}
