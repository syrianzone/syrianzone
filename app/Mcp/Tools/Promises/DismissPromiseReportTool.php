<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseModerationService;
use App\Services\Promises\PromiseRules;
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

#[Name('dismiss-promise-report')]
#[Title('Dismiss Promise Report')]
#[Description(
    'Dismiss a visitor\'s report on a published promise without changing the promise: unsourced, unverifiable, '
    .'already covered, or not about this promise.'
)]
#[IsDestructive]
#[IsIdempotent]
class DismissPromiseReportTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_REVIEW];

    public function schema(JsonSchema $schema): array
    {
        return [
            'report_id' => $schema->integer()
                ->description('Id of the pending report (get-promise-review-queue reports[].id).')
                ->required(),

            'note' => $schema->string()
                ->description('Optional reviewer note in Arabic, kept with the report. Max 2000 characters.')
                ->max(2000),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call get-promise-review-queue to find pending reports.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(PromiseRules::class);
        $validated = $request->validate(['report_id' => 'required|integer', ...$rules->note()], $rules->messages());

        return $this->attempt(function () use ($validated, $context) {
            $moderation = app(PromiseModerationService::class);
            $report = $moderation->dismissReport(
                $moderation->findReport((int) $validated['report_id']),
                $context->user,
                $validated['note'] ?? null,
            );

            return Response::structured([
                'dismissed' => true,
                'report_id' => $report->id,
            ]);
        });
    }
}
