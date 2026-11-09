<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseModerationService;
use App\Services\Promises\PromiseSpeakerService;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('approve-promise-speaker')]
#[Title('Approve Promise Speaker')]
#[Description(
    'Approve a person proposed by the public, so promises can be published in their name. First check that the '
    .'name and title are right and that they are not already listed under another spelling (search-promise-speakers); '
    .'if they are, reject this one and attribute the promise to the existing person instead.'
)]
#[IsDestructive]
#[IsIdempotent]
class ApprovePromiseSpeakerTool extends PromisesTool
{
    protected array $permissions = ['promises.review'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'speaker_id' => $schema->string()
                ->description('UUID of the pending person (get-promise-review-queue speakers[].id).')
                ->required(),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call get-promise-review-queue to find pending people.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['speaker_id' => 'required|string']);

        return $this->attempt(function () use ($validated, $context) {
            $speaker = app(PromiseModerationService::class)->approveSpeaker(
                app(PromiseSpeakerService::class)->find($validated['speaker_id']), $context->user,
            );

            return Response::structured([
                'approved' => true,
                'speaker' => $speaker->loadCount('promises')->toAdminPayload(),
            ]);
        });
    }
}
