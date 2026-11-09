<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseEditor;
use App\Services\Promises\PromisePresenter;
use App\Services\Promises\PromiseRules;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;

#[Name('add-promise-update')]
#[Title('Add Promise Update')]
#[Description(
    'Add an entry to the change log of an unpublished promise (progress reading, official response, or editorial note). '
    .'Published promises are refused: their public log is edited in the dashboard. '
    .'progress and official_response require a source_url. The date cannot precede the statement date or be in the future. '
    .'Status changes (verdicts) are NOT made here.'
)]
class AddPromiseUpdateTool extends PromisesTool
{
    protected array $permissions = ['promises.edit'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the promise. Required.')
                ->required(),

            'type' => $schema->string()
                ->description('Update type: "progress" (for measurable progress reading), "official_response" (official comment/statement), or "note" (editorial update). Required.')
                ->enum(['progress', 'official_response', 'note'])
                ->required(),

            'happened_on' => $schema->string()
                ->description('Date of the event or progress reading (YYYY-MM-DD). Required.')
                ->required(),

            'body' => $schema->string()
                ->description('Text describing the update. Required for official_response and note; optional for progress.')
                ->max(2000),

            'value' => $schema->number()
                ->description('Numeric progress value achieved (required if type is progress).'),

            'source_url' => $schema->string()
                ->description('URL of the source verifying the update (required for progress and official_response).')
                ->max(2048),

            'archive_url' => $schema->string()
                ->description('Optional archive/backup URL.')
                ->max(2048),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () use ($request, $context) {
            $id = (string) $request->get('id');
            $promise = $this->findPromise($id);

            if ($refusal = $this->refusePublished($promise)) {
                return $refusal;
            }

            $rules = app(PromiseRules::class);
            $data = $request->validate([
                'id' => 'required|string',
                ...$rules->update(),
            ], $rules->messages());

            unset($data['id']);

            app(PromiseEditor::class)->addUpdate($promise, $data, $context->user);

            return Response::structured([
                'added' => true,
                'promise' => app(PromisePresenter::class)->adminDetail($promise->fresh()),
            ]);
        });
    }
}
