<?php

namespace App\Mcp\Tools\Polls;

use App\Models\Candidate;
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

#[Name('archive-poll-candidate')]
#[Title('Archive Poll Candidate')]
#[Description(
    'Archive a poll candidate who left their position (moves them from active voting to the "former" '
    .'leaderboard while preserving historical scores up to term_ended_at). If successor_id is provided and '
    .'the successor has no term_started_at, their term_started_at is set to term_ended_at.'
)]
#[IsDestructive]
#[IsIdempotent]
class ArchivePollCandidateTool extends PollTool
{
    protected array $permissions = [PermissionCatalogue::POLLS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Candidate UUID to archive.')
                ->required(),
            'term_ended_at' => $schema->string()
                ->description('Date the candidate left office (YYYY-MM-DD). Defaults to today.'),
            'archive_reason' => $schema->string()
                ->description('Short Arabic reason for archiving (max 200 chars), e.g. "عُيّن مستشاراً لرئاسة الجمهورية".'),
            'successor_id' => $schema->string()
                ->description('Optional UUID of the successor candidate in the same poll.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64',
            'term_ended_at' => 'nullable|date',
            'archive_reason' => 'nullable|string|max:200',
            'successor_id' => 'nullable|string|exists:candidates,id',
        ]);

        $candidate = Candidate::with('poll')->find($validated['id']);
        if ($candidate === null) {
            return Response::error("No candidate exists with id {$validated['id']}.");
        }

        if (! empty($validated['successor_id']) && $validated['successor_id'] === $candidate->id) {
            return Response::error('A candidate cannot be their own successor.');
        }

        $termEnd = $validated['term_ended_at'] ?? now()->toDateString();

        $candidate->update([
            'status' => 'archived',
            'term_ended_at' => $termEnd,
            'archive_reason' => $validated['archive_reason'] ?? null,
            'successor_id' => $validated['successor_id'] ?? null,
        ]);

        if (! empty($validated['successor_id'])) {
            $successor = Candidate::find($validated['successor_id']);
            if ($successor !== null && ! $successor->term_started_at) {
                $successor->update(['term_started_at' => $termEnd]);
            }
        }

        $this->forgetLeaderboard($candidate->poll);

        return Response::structured([
            'archived' => true,
            'candidate' => $this->formatCandidate($candidate->fresh()),
        ]);
    }
}
