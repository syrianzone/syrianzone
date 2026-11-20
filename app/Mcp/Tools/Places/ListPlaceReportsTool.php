<?php

namespace App\Mcp\Tools\Places;

use App\Models\PlaceReport;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-place-reports')]
#[Title('List Place Reports')]
#[Description(
    'List visitor reports filed against published places in Mishwar, newest first. Defaults to "open" '
    .'reports awaiting moderation. Returns each report with its reason, details, status, reporter, '
    .'and linked place.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListPlaceReportsTool extends PlacesTool
{
    protected array $permissions = [PermissionCatalogue::PLACES_REVIEW];

    public function schema(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()
                ->enum([...PlaceReport::STATUSES, 'all'])
                ->description('Report status to list. Defaults to "open". Use "all" to include resolved and dismissed reports.')
                ->default('open'),

            'page' => $schema->integer()
                ->description('Page number, starting at 1.')
                ->default(1)
                ->min(1),

            'per_page' => $schema->integer()
                ->description('Reports per page (1 to 100). Defaults to 20.')
                ->default(20)
                ->min(1)
                ->max(100),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()->description('Status filter that was applied.'),
            'current_page' => $schema->integer(),
            'last_page' => $schema->integer(),
            'total' => $schema->integer(),
            'reports' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->integer(),
                    'reason' => $schema->string(),
                    'details' => $schema->string()->nullable(),
                    'status' => $schema->string(),
                    'created_at' => $schema->string()->nullable(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'status' => ['sometimes', Rule::in([...PlaceReport::STATUSES, 'all'])],
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:100',
        ]);

        $status = $validated['status'] ?? 'open';
        $pageNum = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 20);

        $query = PlaceReport::query()
            ->whereHas('place')
            ->with(['user:id,name', 'place:id,name,status'])
            ->latest();

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $page = $query->paginate($perPage, ['*'], 'page', $pageNum);

        return Response::structured([
            'status' => $status,
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
            'reports' => $page->getCollection()->map(fn (PlaceReport $r) => [
                'id' => $r->id,
                'reason' => $r->reason,
                'details' => $r->details,
                'status' => $r->status,
                'created_at' => $r->created_at?->toIso8601String(),
                'user' => [
                    'id' => $r->user?->id,
                    'name' => $r->user?->name ?? 'مستخدم محذوف',
                ],
                'place' => [
                    'id' => $r->place?->id,
                    'name' => $r->place?->name,
                    'status' => $r->place?->status,
                ],
            ])->values()->all(),
        ]);
    }
}
