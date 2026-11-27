<?php

namespace App\Mcp\Tools\Wildlife;

use App\Exceptions\Wildlife\WildlifeActionException;
use App\Mcp\Tools\AuditedTool;
use App\Models\WildlifeSpecies;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

/**
 * Shared base for the wildlife guide tools (docs/modules/wildlife.md).
 *
 * The domain rules live in App\Services\Wildlife: WildlifeRules checks a
 * record, WildlifeEditor applies a change. A tool only translates arguments in
 * and refusals out, so the agent surface and any later dashboard cannot apply
 * different rules.
 */
abstract class WildlifeTool extends AuditedTool
{
    /** Anyone who may work on the guide may read it, drafts included. */
    protected const READ_PERMISSIONS = [
        PermissionCatalogue::WILDLIFE_EDIT,
        PermissionCatalogue::WILDLIFE_PUBLISH,
        PermissionCatalogue::WILDLIFE_DELETE,
    ];

    /**
     * @param  callable(): (Response|ResponseFactory)  $callback
     */
    protected function attempt(callable $callback): Response|ResponseFactory
    {
        try {
            return $callback();
        } catch (WildlifeActionException $e) {
            return Response::error(match ($e->kind) {
                WildlifeActionException::NOT_FOUND => $e->getMessage().' Call list-wildlife-species for the valid slugs.',
                WildlifeActionException::STALE => $e->getMessage().' Call get-wildlife-species and retry with the version it returns.',
                WildlifeActionException::INVALID => $e->getMessage().' get-wildlife-options lists every allowed value.',
                default => $e->getMessage(),
            });
        }
    }

    protected function slugSchema(JsonSchema $schema): mixed
    {
        return $schema->string()->description('The species slug, e.g. "arabian-oryx".')->required();
    }

    protected function versionSchema(JsonSchema $schema): mixed
    {
        return $schema->integer()
            ->description('The species\' version as get-wildlife-species (or the last write) returned it. Refused if anyone changed the species since.')
            ->min(1)
            ->required();
    }

    /**
     * One species record, in the shape of a species in resources/data/wildlife.json.
     */
    protected function recordSchema(JsonSchema $schema): mixed
    {
        $cited = $schema->object([
            'text' => $schema->string()->description('One statement in Arabic, saying what the cited sources say and no more.'),
            'sources' => $schema->array()->items($schema->integer())->description('Indexes into this record\'s sources list, from 0.'),
        ]);

        return $schema->object([
            'slug' => $schema->string()->description('Lowercase English words joined by dashes; the public URL /wild/{slug}. Cannot change after creation.'),
            'nameAr' => $schema->string(),
            'altNamesAr' => $schema->array()->items($schema->string())->description('Other Arabic names, checked against Wikidata labels. May be empty.'),
            'nameEn' => $schema->string(),
            'scientific' => $schema->string()->description('The species name GBIF accepts; the Red List category is read for it.'),
            'subspecies' => $schema->string()->description('Optional: the named subspecies in Syria. Omit when none.'),
            'group' => $schema->string()->description('mammal, bird, reptile, amphibian, fish or invertebrate.'),
            'iucn' => $schema->object([
                'category' => $schema->string()->description('EX, EW, CR, EN, VU, NT, LC, DD or NE.'),
                'url' => $schema->string()->description('The exact assessment: https://www.iucnredlist.org/species/{taxonId}/{assessmentId}.'),
            ]),
            'iucnNoteAr' => $schema->string()->description('Optional: where readers could confuse the global category with the Syrian status.'),
            'syriaStatus' => $schema->string()->description('resident, breeding-visitor, passage-migrant, winter-visitor, uncertain, possibly-extinct or extinct-in-syria.'),
            'statusNoteAr' => $schema->string()->description('Optional: the status in Syria in a sentence, dated when the source is old.'),
            'habitats' => $schema->array()->items($schema->string())->description('At least one of steppe, mountains, farmland, wetlands, coast.'),
            'governorates' => $schema->array()->items($schema->string())->description('Governorate ids where a cited source places a record. May be empty.'),
            'summaryAr' => $schema->string(),
            'summarySources' => $schema->array()->items($schema->integer())->description('Indexes into sources for the summary.'),
            'factsAr' => $schema->array()->items($cited)->description('At least one fact.'),
            'threatsAr' => $schema->array()->items($cited)->description('May be empty.'),
            'image' => $schema->object([
                'commonsFile' => $schema->string()->description('Wikimedia Commons file name without "File:".'),
                'author' => $schema->string()->description('Copied exactly from the Commons file page.'),
                'license' => $schema->string()->description('CC0 1.0, Public domain, or a CC BY / CC BY-SA version as Commons writes it.'),
                'licenseUrl' => $schema->string()->description('The license link; null for Public domain.')->nullable(),
                'captionAr' => $schema->string()->description('Says where the photo was taken when not in Syria, or that the animal is captive.'),
                'r2Key' => $schema->string()->description('null; wildlife:mirror-images fills it.')->nullable(),
            ]),
            'sources' => $schema->array()->items($schema->object([
                'title' => $schema->string(),
                'url' => $schema->string()->description('https:// link. Never Wikipedia.'),
            ]))->description('At least two, the Red List assessment among them.'),
            'lastReviewed' => $schema->string()->description('YYYY-MM-DD: the day the record was checked against its sources.'),
        ])->description('The whole species record. get-wildlife-options returns a template and the allowed values.');
    }

    /**
     * @return array<string, mixed>
     */
    protected function summary(WildlifeSpecies $species): array
    {
        $shown = $species->record ?? $species->draft ?? [];

        return [
            'slug' => $species->slug,
            'name_ar' => $shown['nameAr'] ?? null,
            'name_en' => $shown['nameEn'] ?? null,
            'scientific' => $shown['scientific'] ?? null,
            'group' => $shown['group'] ?? null,
            'syria_status' => $shown['syriaStatus'] ?? null,
            'iucn_category' => $shown['iucn']['category'] ?? null,
            'state' => $species->state(),
            'has_draft' => $species->draft !== null,
            'version' => $species->version,
            'position' => $species->position,
            'url' => $species->isPublic() ? url('/wild/'.$species->slug) : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function detail(WildlifeSpecies $species): array
    {
        $species->loadMissing('draftAuthor:id,name', 'publisher:id,name');

        return [
            ...$this->summary($species),
            'record' => $species->record,
            'draft' => $species->draft,
            'draft_updated_by' => $species->draftAuthor?->name,
            'draft_updated_at' => $species->draft_updated_at?->toIso8601String(),
            'published_by' => $species->publisher?->name,
            'published_at' => $species->published_at?->toIso8601String(),
        ];
    }

    protected function findSpecies(string $slug): WildlifeSpecies
    {
        return WildlifeSpecies::where('slug', $slug)->first() ?? throw WildlifeActionException::notFound($slug);
    }
}
