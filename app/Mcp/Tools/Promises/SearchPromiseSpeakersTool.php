<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\SpeakerDirectory;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('search-promise-speakers')]
#[Title('Search Promise Speakers')]
#[Description(
    'Search for speakers (officials, candidates, assembly members, or existing promise speakers) by name. '
    .'Every result has a "ref" (e.g. "speaker:<uuid>", "official:<id>", "candidate:<uuid>", "house:<id>") '
    .'which is passed to create-promise and update-promise as "speaker_ref". If the person is not found, '
    .'do not invent one — inform the operator, as adding new people is done in the dashboard.'
)]
#[IsReadOnly]
#[IsIdempotent]
class SearchPromiseSpeakersTool extends PromisesTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return [
            'query' => $schema->string()
                ->description('Search query matching the person\'s name (max 80 chars). Required.')
                ->max(80)
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'query' => 'required|string|max:80',
        ]);

        return $this->attempt(function () use ($validated) {
            $q = mb_substr(trim((string) $validated['query']), 0, 80);

            return Response::structured([
                'speakers' => app(SpeakerDirectory::class)->search($q, forStaff: true),
            ]);
        });
    }
}
