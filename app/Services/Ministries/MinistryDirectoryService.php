<?php

namespace App\Services\Ministries;

use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\OfficialEntity;
use App\Models\Promise;
use App\Support\Facts;
use Illuminate\Support\Collection;

/**
 * Enriches the canonical ministries & sovereign bodies dataset
 * (`resources/data/government/ministries.json`) with live read-only data from
 * GovtOfficial (portraits, bios, CV links), OfficialEntity (official accounts &
 * websites), GovApp (published ministry apps), and Promise (minister promises).
 */
class MinistryDirectoryService
{
    /**
     * All raw entries from `resources/data/government/ministries.json`.
     *
     * @return list<array<string, mixed>>
     */
    public function allRaw(): array
    {
        return Facts::ministries()['ministries'];
    }

    /**
     * @return list<string>
     */
    public function slugs(): array
    {
        return array_values(array_map(
            fn (array $m): string => (string) $m['slug'],
            $this->allRaw(),
        ));
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findRaw(string $slug): ?array
    {
        foreach ($this->allRaw() as $entry) {
            if (($entry['slug'] ?? null) === $slug) {
                return $entry;
            }
        }

        return null;
    }

    /**
     * Full Inertia payload for `/ministries`.
     *
     * @return array<string, mixed>
     */
    public function indexPayload(): array
    {
        $facts = Facts::ministries();
        $rawList = $facts['ministries'];
        $officialsBySlug = $this->loadOfficialsFor($rawList);
        $entitiesById = $this->loadEntitiesFor($rawList);
        $bySlug = $this->indexBySlug($rawList);

        $enriched = array_map(
            fn (array $entry): array => $this->enrichSummary($entry, $officialsBySlug, $entitiesById, $bySlug),
            $rawList,
        );

        $currentCabinet = array_values(array_filter(
            $enriched,
            fn (array $m): bool => $m['kind'] === 'ministry' && $m['status'] === 'current',
        ));
        $historicalMinistries = array_values(array_filter(
            $enriched,
            fn (array $m): bool => $m['kind'] === 'ministry' && $m['status'] !== 'current',
        ));
        $sovereignBodies = array_values(array_filter(
            $enriched,
            fn (array $m): bool => $m['kind'] === 'sovereign',
        ));

        return [
            'meta' => $facts['meta'],
            'eras' => $facts['eras'],
            'restructurings' => array_map(function (array $r) use ($bySlug): array {
                return $r + [
                    'from_ministries' => $this->resolveSlugRefs($r['from_slugs'] ?? [], $bySlug),
                    'to_ministries' => $this->resolveSlugRefs($r['to_slugs'] ?? [], $bySlug),
                ];
            }, $facts['restructurings']),
            // One copy of every entry: the page splits it into the current
            // cabinet, historical ministries and sovereign bodies itself.
            'all_ministries' => $enriched,
            'stats' => [
                'current_ministries' => count($currentCabinet),
                'historical_ministries' => count($historicalMinistries),
                'sovereign_bodies' => count($sovereignBodies),
                'eras_count' => count($facts['eras']),
            ],
        ];
    }

    /**
     * Full Inertia payload for `/ministries/{slug}`, or null when slug does not exist.
     *
     * @return array<string, mixed>|null
     */
    public function showPayload(string $slug): ?array
    {
        $facts = Facts::ministries();
        $rawList = $facts['ministries'];
        $raw = $this->findRaw($slug);
        if ($raw === null) {
            return null;
        }

        $officialsBySlug = $this->loadOfficialsFor([$raw]);
        $entitiesById = $this->loadEntitiesFor([$raw]);
        $bySlug = $this->indexBySlug($rawList);

        $ministry = $this->enrichSummary($raw, $officialsBySlug, $entitiesById, $bySlug);
        $ministry['lineage_events'] = array_map(function (array $ev) use ($bySlug): array {
            return $ev + [
                'related_ministries' => $this->resolveSlugRefs($ev['related_slugs'] ?? [], $bySlug),
            ];
        }, $raw['lineage_events'] ?? []);

        $entityIds = array_values(array_unique(array_filter([
            $raw['official_entity_id'] ?? null,
            ...($raw['related_entity_ids'] ?? []),
        ])));

        $officialAccounts = $this->buildOfficialAccounts($raw, $entitiesById);
        $govApps = $this->loadRelatedGovApps($entityIds);
        $promises = $this->loadRelatedPromises($raw['holders'] ?? [], $officialsBySlug);
        $sources = $this->collectSources($raw, $facts['meta']);

        // Sibling quick navigation: current ministries (or sovereign bodies if this is sovereign)
        $siblings = array_values(array_map(
            fn (array $m): array => [
                'slug' => $m['slug'],
                'name_ar' => $m['name_ar'],
                'status' => $m['status'],
                'kind' => $m['kind'],
            ],
            array_filter(
                $rawList,
                fn (array $m): bool => $m['slug'] !== $slug
                    && $m['kind'] === $raw['kind']
                    && $m['status'] === 'current',
            ),
        ));

        return [
            'meta' => $facts['meta'],
            'eras' => $facts['eras'],
            'ministry' => $ministry,
            'official_accounts' => $officialAccounts,
            'gov_apps' => $govApps,
            'promises' => $promises,
            'sources' => $sources,
            'siblings' => $siblings,
        ];
    }

    /**
     * Resolve enriched SEO context for a single ministry slug (used by MinistryPreview).
     *
     * @return array<string, mixed>|null
     */
    public function seoContext(string $slug): ?array
    {
        $raw = $this->findRaw($slug);
        if ($raw === null) {
            return null;
        }

        $officialsBySlug = $this->loadOfficialsFor([$raw]);
        $entitiesById = $this->loadEntitiesFor([$raw]);
        $bySlug = $this->indexBySlug($this->allRaw());

        $summary = $this->enrichSummary($raw, $officialsBySlug, $entitiesById, $bySlug);
        $primaryEntity = isset($raw['official_entity_id']) ? ($entitiesById[$raw['official_entity_id']] ?? null) : null;

        $website = null;
        $sameAs = [];
        if ($primaryEntity instanceof OfficialEntity && is_array($primaryEntity->socials)) {
            foreach ($primaryEntity->socials as $platform => $url) {
                if (! is_string($url)) {
                    continue;
                }
                $trimmed = trim($url);
                if (! (str_starts_with($trimmed, 'https://') || str_starts_with($trimmed, 'http://'))
                    || filter_var($trimmed, FILTER_VALIDATE_URL) === false) {
                    continue;
                }
                if ($platform === 'website' && $website === null) {
                    $website = $trimmed;
                }
                $sameAs[] = $trimmed;
            }
        }

        return [
            'ministry' => $summary,
            'website' => $website,
            'same_as' => array_values(array_unique($sameAs)),
        ];
    }

    /**
     * Ministry/sovereign-body pages associated with a given GovtOfficial (for cross-links on `/govtcvs/{slug}`).
     *
     * @return list<array{slug: string, href: string, name_ar: string, kind: string, status: string, is_current: bool, role_title: string}>
     */
    public function ministryLinksForOfficial(GovtOfficial $official): array
    {
        $links = [];
        $seen = [];

        foreach ($this->allRaw() as $entry) {
            foreach (array_merge($entry['holders'] ?? [], $entry['deputies'] ?? []) as $holder) {
                if (($holder['govtcvs_slug'] ?? null) !== $official->slug) {
                    continue;
                }
                $slug = (string) $entry['slug'];
                if (isset($seen[$slug])) {
                    // Prefer current status if the same official held the ministry across eras
                    if (! empty($holder['is_current'])) {
                        $links[$seen[$slug]]['is_current'] = true;
                    }

                    continue;
                }
                $seen[$slug] = count($links);
                $links[] = [
                    'slug' => $slug,
                    'href' => '/ministries/'.$slug,
                    'name_ar' => (string) $entry['name_ar'],
                    'kind' => (string) $entry['kind'],
                    'status' => (string) $entry['status'],
                    'is_current' => (bool) ($holder['is_current'] ?? false),
                    'role_title' => (string) ($holder['title'] ?? ''),
                ];
            }
        }

        usort($links, fn (array $a, array $b): int => ($b['is_current'] <=> $a['is_current']));

        return $links;
    }

    /**
     * Map of `/ministries` and `/ministries/{slug}` => list of portrait URLs rendered on those pages
     * (used by ImageSitemapBuilder).
     *
     * @return array<string, list<string>>
     */
    public function portraitsByPath(): array
    {
        $rawList = $this->allRaw();
        $officialsBySlug = $this->loadOfficialsFor($rawList);

        $byPath = [];
        $hubImages = [];

        foreach ($rawList as $entry) {
            $slug = (string) $entry['slug'];
            $pageImages = [];

            foreach (array_merge($entry['holders'] ?? [], $entry['deputies'] ?? []) as $holder) {
                $cvSlug = $holder['govtcvs_slug'] ?? null;
                if (! is_string($cvSlug) || $cvSlug === '') {
                    continue;
                }
                $official = $officialsBySlug[$cvSlug] ?? null;
                if (! $official instanceof GovtOfficial) {
                    continue;
                }
                $portrait = $official->resolvedPortrait();
                if (is_string($portrait) && trim($portrait) !== '') {
                    $pageImages[] = $portrait;
                    if (! empty($holder['is_current']) && $entry['status'] === 'current') {
                        $hubImages[] = $portrait;
                    }
                }
            }

            $unique = array_values(array_unique($pageImages));
            if ($unique !== []) {
                $byPath['/ministries/'.$slug] = $unique;
            }
        }

        $uniqueHub = array_values(array_unique($hubImages));
        if ($uniqueHub !== []) {
            $byPath['/ministries'] = $uniqueHub;
        }

        return $byPath;
    }

    /**
     * @param  list<array<string, mixed>>  $entries
     * @return array<string, GovtOfficial>
     */
    private function loadOfficialsFor(array $entries): array
    {
        $slugs = [];
        foreach ($entries as $entry) {
            foreach (array_merge($entry['holders'] ?? [], $entry['deputies'] ?? []) as $holder) {
                if (! empty($holder['govtcvs_slug'])) {
                    $slugs[] = (string) $holder['govtcvs_slug'];
                }
            }
        }

        $slugs = array_values(array_unique($slugs));
        if ($slugs === []) {
            return [];
        }

        try {
            return GovtOfficial::published()
                ->whereIn('slug', $slugs)
                ->with([
                    'officialEntity',
                    'candidate',
                    'promiseSpeaker.candidate',
                    'promiseSpeaker.officialEntity',
                ])
                ->get()
                ->keyBy('slug')
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @param  list<array<string, mixed>>  $entries
     * @return array<string, OfficialEntity>
     */
    private function loadEntitiesFor(array $entries): array
    {
        $ids = [];
        foreach ($entries as $entry) {
            if (! empty($entry['official_entity_id'])) {
                $ids[] = (string) $entry['official_entity_id'];
            }
            foreach ($entry['related_entity_ids'] ?? [] as $relId) {
                if (is_string($relId) && $relId !== '') {
                    $ids[] = $relId;
                }
            }
        }

        $ids = array_values(array_unique($ids));
        if ($ids === []) {
            return [];
        }

        try {
            return OfficialEntity::query()
                ->where('is_active', true)
                ->whereIn('id', $ids)
                ->get()
                ->keyBy('id')
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @param  list<array<string, mixed>>  $entries
     * @return array<string, array<string, mixed>>
     */
    private function indexBySlug(array $entries): array
    {
        $map = [];
        foreach ($entries as $entry) {
            $map[(string) $entry['slug']] = $entry;
        }

        return $map;
    }

    /**
     * @param  array<string, mixed>  $raw
     * @param  array<string, GovtOfficial>  $officialsBySlug
     * @param  array<string, OfficialEntity>  $entitiesById
     * @param  array<string, array<string, mixed>>  $bySlug
     * @return array<string, mixed>
     */
    private function enrichSummary(
        array $raw,
        array $officialsBySlug,
        array $entitiesById,
        array $bySlug,
    ): array {
        $holders = array_map(
            fn (array $h): array => $this->enrichHolder($h, $officialsBySlug),
            $raw['holders'] ?? [],
        );
        $deputies = array_map(
            fn (array $d): array => $this->enrichHolder($d, $officialsBySlug),
            $raw['deputies'] ?? [],
        );

        $currentHolder = null;
        foreach ($holders as $holder) {
            if ($holder['is_current']) {
                $currentHolder = $holder;
                break;
            }
        }

        $primaryEntity = isset($raw['official_entity_id']) ? ($entitiesById[$raw['official_entity_id']] ?? null) : null;

        return [
            'slug' => $raw['slug'],
            'kind' => $raw['kind'],
            'name_ar' => $raw['name_ar'],
            'name_en' => $raw['name_en'] ?? '',
            'status' => $raw['status'],
            'sort_order' => $raw['sort_order'] ?? 999,
            'official_entity_id' => $raw['official_entity_id'] ?? null,
            'entity_image' => $primaryEntity?->image,
            'entity_description_ar' => $primaryEntity?->description_ar,
            'predecessors' => $this->resolveSlugRefs($raw['predecessors'] ?? [], $bySlug),
            'successors' => $this->resolveSlugRefs($raw['successors'] ?? [], $bySlug),
            'lineage_summary_ar' => $raw['lineage_summary_ar'] ?? null,
            'jard_url' => $raw['jard_url'] ?? 'https://jard.chat/government',
            'current_holder' => $currentHolder,
            'holders' => $holders,
            'deputies' => $deputies,
        ];
    }

    /**
     * @param  array<string, mixed>  $holder
     * @param  array<string, GovtOfficial>  $officialsBySlug
     * @return array<string, mixed>
     */
    private function enrichHolder(array $holder, array $officialsBySlug): array
    {
        $cvSlug = $holder['govtcvs_slug'] ?? null;
        $official = (is_string($cvSlug) && $cvSlug !== '') ? ($officialsBySlug[$cvSlug] ?? null) : null;

        return [
            'name' => (string) $holder['name'],
            'title' => (string) $holder['title'],
            'era' => (string) ($holder['era'] ?? 'transitional_2025'),
            'start_date' => $holder['start_date'] ?? null,
            'end_date' => $holder['end_date'] ?? null,
            'is_current' => (bool) ($holder['is_current'] ?? false),
            'decree' => $holder['decree'] ?? null,
            'notes' => $holder['notes'] ?? null,
            'source_url' => (string) ($holder['source_url'] ?? 'https://jard.chat/government'),
            'source_label' => (string) ($holder['source_label'] ?? 'جَرد'),
            'govtcvs_slug' => $official ? $official->slug : null,
            'govtcvs_url' => $official ? '/govtcvs/'.$official->slug : null,
            'portrait_url' => $official?->resolvedPortrait(),
            'bio_summary_ar' => $official?->bio_summary_ar,
            'office_status' => $official?->office_status,
            'cv_completeness' => $official?->cv_completeness,
        ];
    }

    /**
     * @param  list<string>  $slugs
     * @param  array<string, array<string, mixed>>  $bySlug
     * @return list<array{slug: string, name_ar: string, status: string, kind: string}>
     */
    private function resolveSlugRefs(array $slugs, array $bySlug): array
    {
        $out = [];
        foreach ($slugs as $ref) {
            if (! isset($bySlug[$ref])) {
                continue;
            }
            $m = $bySlug[$ref];
            $out[] = [
                'slug' => (string) $m['slug'],
                'name_ar' => (string) $m['name_ar'],
                'status' => (string) $m['status'],
                'kind' => (string) $m['kind'],
            ];
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $raw
     * @param  array<string, OfficialEntity>  $entitiesById
     * @return array{primary: ?array<string, mixed>, affiliated: list<array<string, mixed>>}
     */
    private function buildOfficialAccounts(array $raw, array $entitiesById): array
    {
        $serialize = function (OfficialEntity $entity): array {
            $socials = [];
            if (is_array($entity->socials)) {
                foreach ($entity->socials as $k => $v) {
                    if (is_string($v) && trim($v) !== '') {
                        $socials[$k] = trim($v);
                    }
                }
            }

            return [
                'id' => $entity->id,
                'name_ar' => $entity->name_ar ?: $entity->name,
                'name_en' => $entity->name,
                'description_ar' => $entity->description_ar,
                'image' => $entity->image,
                'socials' => $socials,
                'syofficial_url' => '/syofficial?q='.urlencode((string) ($entity->name_ar ?: $entity->name)),
            ];
        };

        $primaryId = $raw['official_entity_id'] ?? null;
        $primary = (is_string($primaryId) && isset($entitiesById[$primaryId]))
            ? $serialize($entitiesById[$primaryId])
            : null;

        $affiliated = [];
        foreach ($raw['related_entity_ids'] ?? [] as $relId) {
            if (is_string($relId) && $relId !== $primaryId && isset($entitiesById[$relId])) {
                $affiliated[] = $serialize($entitiesById[$relId]);
            }
        }

        return [
            'primary' => $primary,
            'affiliated' => $affiliated,
        ];
    }

    /**
     * @param  list<string>  $entityIds
     * @return list<array<string, mixed>>
     */
    private function loadRelatedGovApps(array $entityIds): array
    {
        if ($entityIds === []) {
            return [];
        }

        try {
            return GovApp::query()
                ->where('is_active', true)
                ->whereIn('official_entity_id', $entityIds)
                ->orderBy('order_column')
                ->get()
                ->map(fn (GovApp $app): array => [
                    'id' => $app->id,
                    'name_ar' => $app->name_ar ?: $app->name,
                    'description_ar' => $app->description_ar ?: $app->description,
                    'icon' => $app->icon,
                    'has_guide' => $app->hasRichGuide(),
                    'url' => $app->hasRichGuide() ? '/govapps/'.$app->id : '/govapps',
                    'website' => is_array($app->links) ? ($app->links['website'] ?? null) : null,
                ])
                ->values()
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Published promises made by ministers/leaders of this ministry.
     *
     * @param  list<array<string, mixed>>  $holders
     * @param  array<string, GovtOfficial>  $officialsBySlug
     * @return list<array<string, mixed>>
     */
    private function loadRelatedPromises(array $holders, array $officialsBySlug): array
    {
        $speakerMeta = [];
        foreach ($holders as $holder) {
            $cvSlug = $holder['govtcvs_slug'] ?? null;
            if (! is_string($cvSlug) || ! isset($officialsBySlug[$cvSlug])) {
                continue;
            }
            $official = $officialsBySlug[$cvSlug];
            if (! $official->promise_speaker_id) {
                continue;
            }
            $speakerMeta[$official->promise_speaker_id] = [
                'name' => $official->display_name_ar ?: $official->full_name_ar,
                'slug' => $official->slug,
                'is_current' => (bool) ($holder['is_current'] ?? false),
            ];
        }

        if ($speakerMeta === []) {
            return [];
        }

        $speakerIds = array_keys($speakerMeta);

        try {
            $today = Promise::today();
            /** @var Collection<int, Promise> $rows */
            $rows = Promise::published()
                ->with(['speaker', 'coSpeakerRows'])
                ->where(function ($q) use ($speakerIds) {
                    $q->whereIn('speaker_id', $speakerIds)
                        ->orWhereHas('coSpeakerRows', fn ($cq) => $cq->whereIn('speaker_id', $speakerIds));
                })
                ->orderByDesc('statement_date')
                ->orderByDesc('number')
                ->limit(12)
                ->get();

            return $rows->map(function (Promise $p) use ($today, $speakerMeta): array {
                $state = $p->displayState($today);
                $matchedSpeaker = $speakerMeta[$p->speaker_id] ?? null;
                if ($matchedSpeaker === null) {
                    foreach ($p->coSpeakerRows as $row) {
                        if (isset($speakerMeta[$row->speaker_id])) {
                            $matchedSpeaker = $speakerMeta[$row->speaker_id];
                            break;
                        }
                    }
                }

                return [
                    'id' => $p->id,
                    'number' => $p->number,
                    'title' => $p->title,
                    'status' => $p->status,
                    'display_state' => $state,
                    'statement_date' => $p->statement_date?->format('Y-m-d'),
                    'deadline_date' => $p->deadline_date?->format('Y-m-d'),
                    'speaker_name' => $matchedSpeaker['name'] ?? ($p->speaker?->name ?? ''),
                    'speaker_slug' => $matchedSpeaker['slug'] ?? null,
                    'is_current_minister' => (bool) ($matchedSpeaker['is_current'] ?? false),
                    'url' => '/promises/'.$p->number,
                ];
            })->values()->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Deduplicated reference sources for a ministry page.
     *
     * @param  array<string, mixed>  $raw
     * @param  array<string, mixed>  $meta
     * @return list<array{label_ar: string, url: string}>
     */
    private function collectSources(array $raw, array $meta): array
    {
        $byUrl = [];

        $add = function (?string $url, string $label) use (&$byUrl): void {
            if (! is_string($url) || trim($url) === '') {
                return;
            }
            $clean = trim($url);
            if (! isset($byUrl[$clean])) {
                $byUrl[$clean] = ['label_ar' => $label, 'url' => $clean];
            }
        };

        $add($raw['jard_url'] ?? null, 'جَرد — '.$raw['name_ar']);
        $add($meta['source_url'] ?? null, (string) ($meta['source_name_ar'] ?? 'جَرد — هيكلية الحكومة السورية'));

        foreach (array_merge($raw['holders'] ?? [], $raw['deputies'] ?? []) as $holder) {
            $url = $holder['source_url'] ?? null;
            $label = ! empty($holder['decree'])
                ? $holder['decree'].' — '.$holder['name']
                : ($holder['source_label'] ?? ('مصدر سجل '.$holder['name']));
            $add(is_string($url) ? $url : null, (string) $label);
        }

        foreach ($raw['lineage_events'] ?? [] as $ev) {
            $add(
                is_string($ev['source_url'] ?? null) ? $ev['source_url'] : null,
                (string) ($ev['decree'] ?? $ev['label_ar'] ?? 'مصدر التعديل الهيكلي'),
            );
        }

        return array_values($byUrl);
    }
}
