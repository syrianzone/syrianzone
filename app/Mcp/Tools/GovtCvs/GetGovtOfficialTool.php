<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtCvPresenter;
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

#[Name('get-govt-official')]
#[Title('Get Govt Official')]
#[Description(
    'Retrieve full admin details of a government official by UUID or slug, including aliases, tenures with '
    .'predecessor/successor lineage, CV entries, evidence links, cross-module links, and the current version '
    .'required by update-govt-official.'
)]
#[IsReadOnly]
#[IsIdempotent]
class GetGovtOfficialTool extends GovtCvsTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Official UUID (from list-govt-officials). Required unless slug is provided.'),

            'slug' => $schema->string()
                ->description('Official URL slug. Required unless id is provided.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => ['required_without:slug', 'nullable', 'string'],
            'slug' => ['required_without:id', 'nullable', 'string'],
        ]);

        return $this->attempt(function () use ($validated) {
            $key = ! empty($validated['id']) ? (string) $validated['id'] : (string) $validated['slug'];
            $official = $this->findOfficial($key);

            return Response::structured([
                'official' => app(GovtCvPresenter::class)->adminDetail($official),
            ]);
        });
    }
}
