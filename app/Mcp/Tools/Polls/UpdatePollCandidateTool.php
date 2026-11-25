<?php

namespace App\Mcp\Tools\Polls;

use App\Models\Candidate;
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
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('update-poll-candidate')]
#[Title('Update Poll Candidate')]
#[Description(
    'Update metadata on a poll candidate (name, title, x_handle, image_url, candidate_group_id, sort, '
    .'term_started_at, term_ended_at, archive_reason, successor_id). Only supplied fields are changed; '
    .'pass null to clear a nullable field. To archive or restore a candidate, prefer archive-poll-candidate '
    .'or restore-poll-candidate.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdatePollCandidateTool extends PollTool
{
    protected array $permissions = [PermissionCatalogue::POLLS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Candidate UUID from list-poll-candidates.')
                ->required(),
            'candidate_group_id' => $schema->string()
                ->description('Move candidate to another group UUID in the same poll.'),
            'name' => $schema->string()->description('Updated candidate name.'),
            'title' => $schema->string()->description('Updated role/position title. Pass null to clear.'),
            'x_handle' => $schema->string()->description('Updated X/Twitter handle without @. Pass null to clear.'),
            'image_url' => $schema->string()->description('Updated image URL. External HTTP(S) URLs are stored as 200x200 WebP on R2.'),
            'category' => $schema->string()->description('Updated legacy category string.'),
            'sort' => $schema->integer()->description('Updated sort order integer.'),
            'term_started_at' => $schema->string()->description('Term start date (YYYY-MM-DD) or null.'),
            'term_ended_at' => $schema->string()->description('Term end date (YYYY-MM-DD) or null.'),
            'archive_reason' => $schema->string()->description('Archive reason text (max 200 chars) or null.'),
            'successor_id' => $schema->string()->description('Successor candidate UUID or null.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64',
            'candidate_group_id' => 'sometimes|nullable|string|exists:candidate_groups,id',
            'name' => 'sometimes|string|max:255',
            'title' => 'sometimes|nullable|string|max:255',
            'x_handle' => ['sometimes', 'nullable', 'string', 'regex:/^@?[A-Za-z0-9_]{1,15}$/'],
            'image_url' => 'sometimes|nullable|string|max:2048',
            'category' => 'sometimes|nullable|string|max:64',
            'sort' => 'sometimes|integer',
            'term_started_at' => 'sometimes|nullable|date',
            'term_ended_at' => 'sometimes|nullable|date',
            'archive_reason' => 'sometimes|nullable|string|max:200',
            'successor_id' => 'sometimes|nullable|string|exists:candidates,id',
        ]);

        $candidate = Candidate::with('poll')->find($validated['id']);
        if ($candidate === null) {
            return Response::error("No candidate exists with id {$validated['id']}.");
        }

        if (array_key_exists('successor_id', $validated) && $validated['successor_id'] === $candidate->id) {
            return Response::error('A candidate cannot be their own successor.');
        }

        if (array_key_exists('candidate_group_id', $validated) && $validated['candidate_group_id'] !== null) {
            $group = CandidateGroup::find($validated['candidate_group_id']);
            if ($group === null || $group->poll_id !== $candidate->poll_id) {
                return Response::error('The specified candidate_group_id does not belong to this candidate\'s poll.');
            }
        }

        $updates = array_diff_key($validated, ['id' => null]);

        if (array_key_exists('image_url', $updates)) {
            $updates['image_url'] = $this->resolveImageUrl($updates['image_url'], $candidate->id);
        }

        $candidate->update($updates);

        $this->forgetLeaderboard($candidate->poll);

        return Response::structured([
            'updated' => true,
            'candidate' => $this->formatCandidate($candidate->fresh()),
        ]);
    }
}
