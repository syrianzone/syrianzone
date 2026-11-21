<?php

namespace App\Mcp\Tools\Polls;

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Str;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('create-poll-candidate')]
#[Title('Create Poll Candidate')]
#[Description(
    'Add a new active candidate to a poll (e.g. "best-ministers"). Pass candidate_group_id from list-poll-groups. '
    .'External HTTP(S) image_url values are downloaded, centre-cropped to a 200x200 WebP, and stored on R2.'
)]
#[IsDestructive]
class CreatePollCandidateTool extends PollTool
{
    protected array $permissions = [PermissionCatalogue::POLLS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'poll' => $schema->string()
                ->description('Poll UUID or slug, e.g. "best-ministers".')
                ->required(),
            'candidate_group_id' => $schema->string()
                ->description('Candidate group UUID from list-poll-groups.'),
            'name' => $schema->string()
                ->description('Candidate display name (Arabic).')
                ->required(),
            'title' => $schema->string()
                ->description('Role/position title, e.g. "وزير الاقتصاد والتجارة الخارجية".'),
            'x_handle' => $schema->string()
                ->description('Optional X/Twitter handle without @ (e.g. "DrMazharAlwais").'),
            'image_url' => $schema->string()
                ->description('Optional image URL. External HTTP(S) URLs are fetched and stored as 200x200 WebP on R2.'),
            'category' => $schema->string()
                ->description('Optional legacy category string (defaults to the group key or "minister").'),
            'sort' => $schema->integer()
                ->description('Optional sort order integer (defaults to 0).'),
            'term_started_at' => $schema->string()
                ->description('Optional term start date (YYYY-MM-DD).'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'poll' => 'required|string|max:128',
            'candidate_group_id' => 'nullable|string|exists:candidate_groups,id',
            'name' => 'required|string|max:255',
            'title' => 'nullable|string|max:255',
            'x_handle' => ['nullable', 'string', 'regex:/^@?[A-Za-z0-9_]{1,15}$/'],
            'image_url' => 'nullable|string|max:2048',
            'category' => 'nullable|string|max:64',
            'sort' => 'sometimes|integer',
            'term_started_at' => 'nullable|date',
        ]);

        $poll = $this->resolvePoll($validated['poll']);
        if ($poll === null) {
            return Response::error("No poll found for '{$validated['poll']}'. Call list-polls for valid slugs and ids.");
        }

        $group = null;
        if (! empty($validated['candidate_group_id'])) {
            $group = CandidateGroup::find($validated['candidate_group_id']);
            if ($group === null || $group->poll_id !== $poll->id) {
                return Response::error('The specified candidate_group_id does not belong to this poll.');
            }
        }

        $id = (string) Str::uuid();
        $resolvedImage = $this->resolveImageUrl($validated['image_url'] ?? null, $id);

        $candidate = Candidate::create([
            'id' => $id,
            'poll_id' => $poll->id,
            'candidate_group_id' => $validated['candidate_group_id'] ?? null,
            'name' => $validated['name'],
            'title' => $validated['title'] ?? null,
            'x_handle' => $validated['x_handle'] ?? null,
            'image_url' => $resolvedImage,
            'category' => $validated['category'] ?? $group?->key ?? 'minister',
            'sort' => $validated['sort'] ?? 0,
            'status' => 'active',
            'term_started_at' => $validated['term_started_at'] ?? null,
        ]);

        $this->forgetLeaderboard($poll);

        return Response::structured([
            'created' => true,
            'candidate' => $this->formatCandidate($candidate->fresh()),
        ]);
    }
}
