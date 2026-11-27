<?php

namespace App\Mcp\Tools\Wildlife;

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

#[Name('get-wildlife-species')]
#[Title('Get Wildlife Species')]
#[Description(
    'One species of the wildlife guide: the published record (what /wild/{slug} shows), the pending draft if any, '
    .'who last edited and published it, and its version. Read it before any write: update-wildlife-draft replaces '
    .'the whole draft and needs this version.'
)]
#[IsReadOnly]
#[IsIdempotent]
class GetWildlifeSpeciesTool extends WildlifeTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return ['slug' => $this->slugSchema($schema)];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['slug' => 'required|string|max:80']);

        return $this->attempt(fn () => Response::structured($this->detail($this->findSpecies($validated['slug']))));
    }
}
