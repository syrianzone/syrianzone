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

#[Name('restore-poll-candidate')]
#[Title('Restore Poll Candidate')]
#[Description(
    'Restore an archived poll candidate back to active status, clearing term_ended_at, archive_reason, and successor_id.'
)]
#[IsDestructive]
#[IsIdempotent]
class RestorePollCandidateTool extends PollTool
{
    protected array $permissions = [PermissionCatalogue::POLLS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Candidate UUID to restore.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64',
        ]);

        $candidate = Candidate::with('poll')->find($validated['id']);
        if ($candidate === null) {
            return Response::error("No candidate exists with id {$validated['id']}.");
        }

        $candidate->update([
            'status' => 'active',
            'term_ended_at' => null,
            'archive_reason' => null,
            'successor_id' => null,
        ]);

        $this->forgetLeaderboard($candidate->poll);

        return Response::structured([
            'restored' => true,
            'candidate' => $this->formatCandidate($candidate->fresh()),
        ]);
    }
}
