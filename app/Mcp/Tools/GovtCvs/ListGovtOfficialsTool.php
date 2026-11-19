<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtCvVocabulary;
use App\Services\GovtCvs\GovtOfficialDirectory;
use App\Support\Agents\AgentContext;
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

#[Name('list-govt-officials')]
#[Title('List Govt Officials')]
#[Description(
    'List tracked Syrian government officials (including drafts, published, and archived records) with folded '
    .'Arabic search and facet filters. Returned ids and slugs can be passed to get-govt-official.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListGovtOfficialsTool extends GovtCvsTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return [
            'q' => $schema->string()
                ->description('Search term matching Arabic/English names, aliases, bio summary, role titles, or institutions (max 100 chars).')
                ->max(100),

            'publish_status' => $schema->string()
                ->description('Filter by publish status ("draft", "published", "archived").')
                ->enum(GovtCvVocabulary::publishStatuses()),

            'office_status' => $schema->string()
                ->description('Filter by office status ("in_office", "out_of_office", "uncertain", "deceased").')
                ->enum(GovtCvVocabulary::officeStatuses()),

            'tier' => $schema->string()
                ->description('Filter by seniority tier key (from get-govtcv-options).')
                ->enum(GovtCvVocabulary::tiers()),

            'institution_id' => $schema->string()
                ->description('Filter by institution ID (from get-govtcv-options) or Arabic institution name.')
                ->max(255),

            'cv_completeness' => $schema->string()
                ->description('Filter by CV completeness ("full_cv", "partial_bio", "positions_only").')
                ->enum(GovtCvVocabulary::cvCompleteness()),

            'per_page' => $schema->integer()
                ->description('Results per page (1-200). Defaults to 50.')
                ->min(1)
                ->max(200)
                ->default(50),

            'page' => $schema->integer()
                ->description('Page number starting at 1. Defaults to 1.')
                ->min(1)
                ->default(1),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'publish_status' => ['sometimes', 'nullable', Rule::in(GovtCvVocabulary::publishStatuses())],
            'office_status' => ['sometimes', 'nullable', Rule::in(GovtCvVocabulary::officeStatuses())],
            'tier' => ['sometimes', 'nullable', Rule::in(GovtCvVocabulary::tiers())],
            'institution_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'cv_completeness' => ['sometimes', 'nullable', Rule::in(GovtCvVocabulary::cvCompleteness())],
            'per_page' => ['sometimes', 'integer', 'between:1,200'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        return $this->attempt(function () use ($validated) {
            $filters = [
                'q' => $validated['q'] ?? null,
                'publish_status' => $validated['publish_status'] ?? null,
                'status' => $validated['office_status'] ?? null,
                'tier' => $validated['tier'] ?? null,
                'institution_id' => $validated['institution_id'] ?? null,
                'cv_completeness' => $validated['cv_completeness'] ?? null,
            ];

            $all = app(GovtOfficialDirectory::class)->adminList($filters);

            $perPage = (int) ($validated['per_page'] ?? 50);
            $page = (int) ($validated['page'] ?? 1);
            $total = count($all);
            $lastPage = max(1, (int) ceil($total / $perPage));
            $items = array_values(array_slice($all, ($page - 1) * $perPage, $perPage));

            return Response::structured([
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => $lastPage,
                'count' => count($items),
                'officials' => $items,
            ]);
        });
    }
}
