<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseModerationService;
use App\Services\Promises\PromiseRules;
use App\Services\Promises\PromiseSpeakerService;
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

#[Name('reject-promise-speaker')]
#[Title('Reject Promise Speaker')]
#[Description(
    'Reject a person proposed by the public: a duplicate of someone already listed, not a public official, or '
    .'not a real person. Unpublished promises attributed to them cannot be published until they are moved to an '
    .'approved person. Refused when the person already has published promises. Give a short reason in Arabic.'
)]
#[IsDestructive]
#[IsIdempotent]
class RejectPromiseSpeakerTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_REVIEW];

    public function schema(JsonSchema $schema): array
    {
        return [
            'speaker_id' => $schema->string()
                ->description('UUID of the pending person (get-promise-review-queue speakers[].id).')
                ->required(),

            'reason' => $schema->string()
                ->description('Why they were rejected, in Arabic. Max 1000 characters.')
                ->max(1000),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call get-promise-review-queue to find pending people.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(PromiseRules::class);
        $validated = $request->validate(['speaker_id' => 'required|string', ...$rules->reason()], $rules->messages());

        return $this->attempt(function () use ($validated, $context) {
            $speaker = app(PromiseModerationService::class)->rejectSpeaker(
                app(PromiseSpeakerService::class)->find($validated['speaker_id']),
                $context->user,
                $validated['reason'] ?? null,
            );

            return Response::structured([
                'rejected' => true,
                'speaker' => $speaker->loadCount('promises')->toAdminPayload(),
            ]);
        });
    }
}
