<?php

namespace App\Mcp\Tools\Wildlife;

use App\Services\Wildlife\WildlifeRules;
use App\Support\Agents\AgentContext;
use App\Support\Facts;
use App\Support\Seo\Preview\Resolvers\WildSpeciesPreview;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get-wildlife-options')]
#[Title('Get Wildlife Options')]
#[Description(
    'Everything needed to write a valid species record: the allowed groups, statuses, habitats, Red List '
    .'categories and governorate ids, the photo license rule, the sourcing rules, and a record template. '
    .'Read it before create-wildlife-species or update-wildlife-draft.'
)]
#[IsReadOnly]
#[IsIdempotent]
class GetWildlifeOptionsTool extends WildlifeTool
{
    protected array $anyPermissions = self::READ_PERMISSIONS;

    public function schema(JsonSchema $schema): array
    {
        return [];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return Response::structured([
            'groups' => WildlifeRules::GROUPS,
            'syria_statuses' => WildSpeciesPreview::statusLabels(),
            'iucn_categories' => WildSpeciesPreview::iucnLabels(),
            'habitats' => WildlifeRules::HABITATS,
            'governorates' => collect(Facts::governorates())->map(fn (array $g) => ['id' => $g['id'], 'name_ar' => $g['name_ar']])->values()->all(),
            'photo_license_pattern' => WildlifeRules::LICENSE,
            'sourcing_rules' => [
                'Nothing from memory: every sentence (summary, each fact, each threat) cites sources by index, and no listed source may be missing a statement it is cited for.',
                'At least two sources per species, one Syria-specific where one exists. Wikipedia is never a source.',
                'iucn.url is the exact Red List assessment; GBIF mirrors it at api.gbif.org/v1/species/{key}/iucnRedListCategory.',
                'The global IUCN category is not the Syrian status; say so in iucnNoteAr where readers could confuse them.',
                'Use extinct-in-syria only when a source says so outright; possibly-extinct or uncertain otherwise.',
                'Keep the source\'s hedges ("may", "probably") and date old status statements ("بحسب قائمة 2008").',
                'governorates: only where a cited source places a documented record.',
                'Photos from Wikimedia Commons under CC0, public domain, CC BY or CC BY-SA; author and license copied exactly; the caption says where it was taken when not in Syria.',
                'lastReviewed is the day you checked the record against its sources.',
                'Drafts are reviewed by a second person, who publishes them with publish-wildlife-species.',
            ],
            'template' => [
                'slug' => 'arabian-oryx',
                'nameAr' => 'المها العربي',
                'altNamesAr' => [],
                'nameEn' => 'Arabian oryx',
                'scientific' => 'Oryx leucoryx',
                'group' => 'mammal',
                'iucn' => ['category' => 'VU', 'url' => 'https://www.iucnredlist.org/species/15569/50191626'],
                'syriaStatus' => 'extinct-in-syria',
                'statusNoteAr' => '…',
                'habitats' => ['steppe'],
                'governorates' => ['homs'],
                'summaryAr' => '…',
                'summarySources' => [0, 1],
                'factsAr' => [['text' => '…', 'sources' => [0]]],
                'threatsAr' => [],
                'image' => [
                    'commonsFile' => 'Arabian oryx (oryx leucoryx).jpg',
                    'author' => 'Charles J. Sharp',
                    'license' => 'CC BY-SA 3.0',
                    'licenseUrl' => 'https://creativecommons.org/licenses/by-sa/3.0',
                    'captionAr' => '…',
                    'r2Key' => null,
                ],
                'sources' => [
                    ['title' => '…', 'url' => 'https://…'],
                    ['title' => 'IUCN Red List — Oryx leucoryx', 'url' => 'https://www.iucnredlist.org/species/15569/50191626'],
                ],
                'lastReviewed' => now()->toDateString(),
            ],
        ]);
    }
}
