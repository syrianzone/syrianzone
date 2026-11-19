<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtCvPresenter;
use App\Services\GovtCvs\GovtCvRules;
use App\Services\GovtCvs\GovtTenureTracker;
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

#[Name('add-govt-tenure')]
#[Title('Add Govt Tenure')]
#[Description(
    'Add a government tenure (appointment/position) to an official. Automatically recomputes the official\'s '
    .'office_status, highest_tier, and first/last seen dates. When office_slot_id points to a single-seat slot '
    .'and status="current", any existing current incumbent on that slot is automatically closed unless '
    .'auto_close_incumbent=false.'
)]
#[IsDestructive]
class AddGovtTenureTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'official_id' => $schema->string()
                ->description('UUID or slug of the official. Required.')
                ->required(),

            ...$this->tenureFieldsSchema($schema, partial: false),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(GovtCvRules::class);
        $data = $request->validate([
            'official_id' => ['required', 'string'],
            ...$rules->tenure(),
        ], $rules->messages());

        return $this->attempt(function () use ($data) {
            $official = $this->findOfficial((string) $data['official_id']);
            unset($data['official_id']);

            $tenure = app(GovtTenureTracker::class)->saveTenure($official, null, $data);
            $presenter = app(GovtCvPresenter::class);

            return Response::structured([
                'added' => true,
                'tenure' => $presenter->tenureItem($tenure),
                'official' => $presenter->adminDetail($official->fresh()),
            ]);
        });
    }
}
