<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseRules;
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

#[Name('create-promise-speaker')]
#[Title('Create Promise Speaker')]
#[Description(
    'Add a person promises can be attributed to. Prefer linking someone the site already knows: pass a `ref` from '
    .'search-promise-speakers (official:, candidate: or house:), which reuses their photo and handle and never '
    .'creates a duplicate. Only type a name when search finds nobody, after trying other spellings. Names and '
    .'titles are in Arabic. A new person is approved straight away, and a ref to someone already listed returns '
    .'them unchanged; either way the returned `ref` goes into create-promise.'
)]
#[IsDestructive]
class CreatePromiseSpeakerTool extends PromisesTool
{
    protected array $permissions = ['promises.speakers'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'ref' => $schema->string()
                ->description('A ref from search-promise-speakers. Required unless name is given.')
                ->max(80),

            'name' => $schema->string()
                ->description('Full name in Arabic, when there is no ref. Max 255 characters.')
                ->max(255),

            ...$this->speakerFieldsSchema($schema),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call search-promise-speakers and pass one of the returned `ref` values.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(PromiseRules::class);
        $data = $request->validate($rules->newSpeaker(), $rules->messages());

        return $this->attempt(function () use ($data) {
            $speaker = app(PromiseSpeakerService::class)->create($data);

            return Response::structured([
                'ref' => $speaker->ref(),
                'speaker' => $speaker->toAdminPayload(),
            ]);
        });
    }
}
