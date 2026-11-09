<?php

namespace App\Mcp\Tools\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Promise;
use App\Services\Promises\PromisePresenter;
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

#[Name('get-promise')]
#[Title('Get Promise')]
#[Description(
    'Retrieve full details of a promise by its UUID or public number. '
    .'Includes sources and the public change log (updates); each update has an id usable with remove-promise-update.'
)]
#[IsReadOnly]
#[IsIdempotent]
class GetPromiseTool extends PromisesTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Promise UUID (from list-promises). Required unless number is provided.'),

            'number' => $schema->integer()
                ->description('Public sequential promise number (for published promises). Required unless id is provided.')
                ->min(1),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required_without:number|nullable|string',
            'number' => 'required_without:id|nullable|integer|min:1',
        ]);

        return $this->attempt(function () use ($validated) {
            $promise = ! empty($validated['id'])
                ? $this->findPromise($validated['id'])
                : (Promise::where('number', (int) $validated['number'])->first() ?? throw PromiseActionException::notFound());

            return Response::structured([
                'promise' => app(PromisePresenter::class)->adminDetail($promise),
            ]);
        });
    }
}
