<?php

namespace App\Mcp\Tools\Promises;

use App\Models\PromiseUpdate;
use App\Services\Promises\PromiseFormOptions;
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

#[Name('get-promise-form-options')]
#[Title('Get Promise Form Options')]
#[Description(
    'Retrieve form options for promises: valid sector ids, governorate slugs, venues, source types, '
    .'institution ids, earliest allowed statement date, today\'s date in Syria, and valid update types. '
    .'Call this before creating or updating a promise.'
)]
#[IsReadOnly]
#[IsIdempotent]
class GetPromiseFormOptionsTool extends PromisesTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return [];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () {
            $options = app(PromiseFormOptions::class)->forEditor();
            $options['updateTypes'] = array_values(array_diff(PromiseUpdate::TYPES, ['status_change']));

            return Response::structured($options);
        });
    }
}
