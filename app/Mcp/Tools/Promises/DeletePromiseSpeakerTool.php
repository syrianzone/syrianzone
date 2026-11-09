<?php

namespace App\Mcp\Tools\Promises;

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

#[Name('delete-promise-speaker')]
#[Title('Delete Promise Speaker')]
#[Description(
    'Delete a person who was added by mistake. Refused while any promise, including a deleted one, is attributed '
    .'to them: move those promises to the right person with update-promise first.'
)]
#[IsDestructive]
class DeletePromiseSpeakerTool extends PromisesTool
{
    protected array $permissions = ['promises.speakers'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'speaker_id' => $schema->string()
                ->description('UUID of the person (the id in their `speaker:` ref).')
                ->required(),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call list-promise-speakers to find valid ids.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['speaker_id' => 'required|string']);

        return $this->attempt(function () use ($validated) {
            $service = app(PromiseSpeakerService::class);
            $service->delete($service->find($validated['speaker_id']));

            return Response::structured([
                'deleted' => true,
                'speaker_id' => $validated['speaker_id'],
            ]);
        });
    }
}
