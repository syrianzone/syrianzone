<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Models\GovtOfficeSlot;
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

#[Name('list-govt-slots')]
#[Title('List Govt Slots')]
#[Description(
    'List all government office slots (e.g. "وزير الطاقة", "محافظ دمشق") with their seniority tier, '
    .'single-seat flag, lifecycle status, current holder, and full tenure holder history.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListGovtSlotsTool extends GovtCvsTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return [];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () {
            $slots = GovtOfficeSlot::query()
                ->with(['institution', 'replacedBy', 'tenures.official'])
                ->withCount('tenures')
                ->orderBy('title_ar')
                ->get();

            $presenter = app(GovtCvPresenter::class);

            return Response::structured([
                'count' => $slots->count(),
                'slots' => $slots->map(fn (GovtOfficeSlot $slot) => $presenter->slotItem($slot))->values()->all(),
            ]);
        });
    }
}
