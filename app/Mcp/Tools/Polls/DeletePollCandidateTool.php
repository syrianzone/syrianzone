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

#[Name('delete-poll-candidate')]
#[Title('Delete Poll Candidate')]
#[Description(
    'Permanently delete a poll candidate row. Prefer archive-poll-candidate for officials who left office '
    .'so their historical votes and scores remain intact.'
)]
#[IsDestructive]
class DeletePollCandidateTool extends PollTool
{
    protected array $permissions = [PermissionCatalogue::POLLS_DELETE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Candidate UUID to delete permanently.')
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

        $poll = $candidate->poll;
        $candidate->delete();

        $this->forgetLeaderboard($poll);

        return Response::structured([
            'deleted' => true,
            'id' => $validated['id'],
        ]);
    }
}
