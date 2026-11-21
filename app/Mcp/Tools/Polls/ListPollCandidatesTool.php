<?php

namespace App\Mcp\Tools\Polls;

use App\Models\Candidate;
use App\Services\Polls\PollRules;
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

#[Name('list-poll-candidates')]
#[Title('List Poll Candidates')]
#[Description(
    'List candidates in a poll (e.g. "best-ministers"), optionally filtered by status (active, former/archived, all), '
    .'candidate_group_id, group_key (e.g. minister, governor, security), or name/title search.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListPollCandidatesTool extends PollTool
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
            'status' => $schema->string()
                ->description('Filter by status: active, former (or archived), or all. Defaults to all.')
                ->enum(['active', 'former', 'archived', 'all']),
            'candidate_group_id' => $schema->string()
                ->description('Optional candidate group UUID to filter by.'),
            'group_key' => $schema->string()
                ->description('Optional group key to filter by (e.g. "minister", "governor", "security").'),
            'search' => $schema->string()
                ->description('Optional substring match on candidate name or title.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'poll' => 'required|string|max:128',
            'status' => app(PollRules::class)->statusFilter(),
            'candidate_group_id' => 'sometimes|nullable|string|max:64',
            'group_key' => 'sometimes|nullable|string|max:64',
            'search' => 'sometimes|nullable|string|max:128',
        ]);

        $poll = $this->resolvePoll($validated['poll']);
        if ($poll === null) {
            return Response::error("No poll found for '{$validated['poll']}'. Call list-polls for valid slugs and ids.");
        }

        $status = PollRules::normalizeStatus($validated['status'] ?? 'all');

        $query = Candidate::query()
            ->with('group')
            ->where('poll_id', $poll->id)
            ->orderBy('sort')
            ->orderBy('name');

        if ($status === 'active') {
            $query->where('status', 'active');
        } elseif ($status === 'former') {
            $query->where('status', 'archived');
        }

        if (! empty($validated['candidate_group_id'])) {
            $query->where('candidate_group_id', $validated['candidate_group_id']);
        }

        if (! empty($validated['group_key'])) {
            $key = $validated['group_key'];
            $query->whereHas('group', fn ($q) => $q->where('key', $key));
        }

        if (! empty($validated['search'])) {
            $term = '%'.$validated['search'].'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('title', 'like', $term);
            });
        }

        $candidates = $query->get();

        return Response::structured([
            'poll_id' => $poll->id,
            'poll_slug' => $poll->slug,
            'status' => $status,
            'count' => $candidates->count(),
            'candidates' => $candidates->map(fn (Candidate $c) => $this->formatCandidate($c))->all(),
        ]);
    }
}
