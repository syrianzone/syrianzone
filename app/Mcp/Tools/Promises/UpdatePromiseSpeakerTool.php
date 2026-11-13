<?php

namespace App\Mcp\Tools\Promises;

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

#[Name('update-promise-speaker')]
#[Title('Update Promise Speaker')]
#[Description(
    'Correct a person\'s name, current title, institution, photo or handle. This is a full replacement: optional '
    .'fields you leave out are cleared, so resend the values from list-promise-speakers. Each promise keeps the '
    .'title the person held when they made it.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdatePromiseSpeakerTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_SPEAKERS];

    public function schema(JsonSchema $schema): array
    {
        return [
            'speaker_id' => $schema->string()
                ->description('UUID of the person (the id in their `speaker:` ref).')
                ->required(),

            'name' => $schema->string()
                ->description('Full name in Arabic. Max 255 characters.')
                ->max(255)
                ->required(),

            ...$this->speakerFieldsSchema($schema),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call list-promise-speakers to find valid ids.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(PromiseRules::class);
        $data = $request->validate(
            ['speaker_id' => 'required|string', ...$rules->speaker(required: true)],
            $rules->messages(),
        );

        return $this->attempt(function () use ($data) {
            $service = app(PromiseSpeakerService::class);
            $speaker = $service->update($service->find($data['speaker_id']), $data);

            return Response::structured([
                'updated' => true,
                'speaker' => $speaker->toAdminPayload(),
            ]);
        });
    }
}
