<?php

namespace App\Mcp\Tools\Places;

use App\Services\Places\PlaceAuditService;
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

#[Name('audit-places')]
#[Title('Audit Places')]
#[Description(
    'Audit approved Mishwar places for data quality problems. Returns structured findings with ids, names, '
    .'governorates, counts, coordinates and canonical URLs across five kinds: '
    .'duplicate_names (same folded name, with distance and likely verdict: "duplicate" <=1 km -> inspect with get-place '
    .'and merge the weaker entry using merge-places; "check_coordinates" -> verify photos and coords and fix misplaced pins '
    .'with update-place before deciding whether to merge; "same_name_different_place" >=25 km in different governorates -> '
    .'legitimately distinct places, keep separate), '
    .'nearby_similar (different folded names within 0.2 km where one contains the other -> verify with get-place and merge '
    .'with merge-places if identical), '
    .'latin_only_names (no Arabic letter -> rename to Arabic with update-place), '
    .'thin (noindex pages with <15 words and <=1 photo -> enrich description with update-place), '
    .'no_governorate (pin outside every Syrian governorate polygon -> verify and fix lat/lng with update-place).'
)]
#[IsReadOnly]
#[IsIdempotent]
class AuditPlacesTool extends PlacesTool
{
    protected array $permissions = [PermissionCatalogue::PLACES_REVIEW];

    public function schema(JsonSchema $schema): array
    {
        return [
            'kinds' => $schema->array()
                ->items($schema->string()->enum(PlaceAuditService::KINDS))
                ->description('Optional subset of audit kinds to run. Omit to run all five kinds.'),

            'limit' => $schema->integer()
                ->description('Maximum findings returned per kind (1 to 200). Defaults to '.PlaceAuditService::DEFAULT_LIMIT.'. Total counts are always returned.')
                ->default(PlaceAuditService::DEFAULT_LIMIT)
                ->min(1)
                ->max(200),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'kinds' => ['sometimes', 'array'],
            'kinds.*' => ['string', Rule::in(PlaceAuditService::KINDS)],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:200'],
        ]);

        $kinds = $validated['kinds'] ?? null;
        $limit = (int) ($validated['limit'] ?? PlaceAuditService::DEFAULT_LIMIT);

        return Response::structured(
            app(PlaceAuditService::class)->audit($kinds, $limit)
        );
    }
}
