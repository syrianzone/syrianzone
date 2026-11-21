<?php

namespace App\Mcp\Tools\Polls;

use App\Models\CandidateGroup;
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

#[Name('list-poll-groups')]
#[Title('List Poll Groups')]
#[Description(
    'List candidate groups (categories/tabs) for a poll by poll UUID or slug (e.g. "best-ministers"), '
    .'including active status, sort order, key, and candidate count.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListPollGroupsTool extends PollTool
{
    public function __construct()
    {
        $this->anyPermissions = PermissionCatalogue::forModule('polls');
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'poll' => $schema->string()
                ->description('Poll UUID or slug, e.g. "best-ministers".')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'poll' => 'required|string|max:128',
        ]);

        $poll = $this->resolvePoll($validated['poll']);
        if ($poll === null) {
            return Response::error("No poll found for '{$validated['poll']}'. Call list-polls for valid slugs and ids.");
        }

        $groups = CandidateGroup::query()
            ->where('poll_id', $poll->id)
            ->withCount('candidates')
            ->orderBy('sort_order')
            ->get();

        return Response::structured([
            'poll_id' => $poll->id,
            'poll_slug' => $poll->slug,
            'count' => $groups->count(),
            'groups' => $groups->map(fn (CandidateGroup $group) => [
                'id' => $group->id,
                'name' => $group->name,
                'key' => $group->key,
                'sort_order' => (int) ($group->sort_order ?? 0),
                'is_default' => (bool) $group->is_default,
                'is_active' => (bool) $group->is_active,
                'candidates_count' => (int) ($group->candidates_count ?? 0),
            ])->all(),
        ]);
    }
}
