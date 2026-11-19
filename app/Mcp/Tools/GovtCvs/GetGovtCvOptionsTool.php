<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtOfficialDirectory;
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

#[Name('get-govtcv-options')]
#[Title('Get Govt CV Options')]
#[Description(
    'Retrieve form and filter options for the Government CVs module: cutoff date, office statuses, seniority tiers, '
    .'government phases, tenure statuses, end reasons, CV sections, completeness levels, evidence types, publish statuses, '
    .'verification levels, alias types, date precisions, slot statuses, institutions, and office slots. '
    .'Call this before creating or updating officials, tenures, CV entries, evidence links, or office slots.'
)]
#[IsReadOnly]
#[IsIdempotent]
class GetGovtCvOptionsTool extends GovtCvsTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return [];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () {
            return Response::structured(
                app(GovtOfficialDirectory::class)->options(true)
            );
        });
    }
}
