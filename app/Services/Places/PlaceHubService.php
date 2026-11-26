<?php

namespace App\Services\Places;

use App\Http\Controllers\PlaceController;
use App\Models\Place;
use App\Services\Sitemap\SitemapUrl;
use App\Support\Facts;
use App\Support\Seo\Preview\Arabic;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Queries, thresholds and copy for Mishwar governorate and category hub pages
 * (`/mishwar/{governorate}` and `/mishwar/{governorate}/{category}`).
 *
 * Shared by PlaceHubController, PlaceHubPreview and SitemapBuilder so counts,
 * ordering, indexability thresholds and wording cannot drift.
 */
final class PlaceHubService
{
    public function __construct(private readonly PlaceGovernorates $governorates) {}

    public function minGovernoratePlaces(): int
    {
        return max(1, (int) config('places.min_governorate_places', 3));
    }

    public function minCategoryPlaces(): int
    {
        return max(1, (int) config('places.min_category_places', 5));
    }

    public function isHubCategory(string $category): bool
    {
        return $category !== 'other' && array_key_exists($category, Facts::placeCategoryHubTitles());
    }

    /**
     * Resolve `/mishwar/{governorate}` hub payload, or null when the governorate
     * is unknown or has zero approved places (404).
     *
     * @return array<string, mixed>|null
     */
    public function forGovernorate(string $governorateId): ?array
    {
        $gov = Facts::governorate($governorateId);
        if ($gov === null) {
            return null;
        }

        $places = $this->placesInGovernorate($governorateId);
        if ($places->isEmpty()) {
            return null;
        }

        $total = $places->count();
        $minGov = $this->minGovernoratePlaces();
        $minCat = $this->minCategoryPlaces();
        $govNameAr = (string) $gov['name_ar'];
        $categoryLabels = $this->categoryLabels();

        $counts = [];
        foreach ($places as $place) {
            $key = (string) $place->category;
            $counts[$key] = ($counts[$key] ?? 0) + 1;
        }

        $categoryOrder = array_flip(Facts::placeCategories());
        uksort($counts, function (string $a, string $b) use ($counts, $categoryOrder): int {
            $cmp = $counts[$b] <=> $counts[$a];

            return $cmp !== 0 ? $cmp : (($categoryOrder[$a] ?? 999) <=> ($categoryOrder[$b] ?? 999));
        });

        $categories = [];
        foreach ($counts as $key => $count) {
            $linkable = $this->isHubCategory($key) && $count >= $minCat;
            $categories[] = [
                'key' => $key,
                'label' => $categoryLabels[$key] ?? $key,
                'count' => $count,
                'url' => $linkable ? '/mishwar/'.$governorateId.'/'.$key : null,
            ];
        }

        return [
            'governorate' => [
                'id' => $governorateId,
                'name_ar' => $govNameAr,
            ],
            'category' => null,
            'h1' => $this->h1($govNameAr, null),
            'intro' => $this->intro($total, $govNameAr, null),
            'description' => $this->metaDescription($places, $total, $govNameAr, null),
            'total' => $total,
            'indexable' => $total >= $minGov,
            'map_url' => '/mishwar?gov='.$governorateId,
            'governorate_url' => '/governorates/'.$governorateId,
            'hub_url' => '/mishwar/'.$governorateId,
            'categories' => $categories,
            'places' => $places->map(fn (Place $p) => $this->formatPlace($p, $categoryLabels))->values()->all(),
            'place_items' => $this->itemListEntries($places),
            'other_hubs' => $this->otherIndexableHubs($governorateId),
        ];
    }

    /**
     * Resolve `/mishwar/{governorate}/{category}`.
     *
     * @return array{status: 'not_found'}|array{status: 'redirect', to: string}|array{status: 'ok', data: array<string, mixed>}
     */
    public function forCategory(string $governorateId, string $category): array
    {
        $gov = Facts::governorate($governorateId);
        if ($gov === null || ! $this->isHubCategory($category)) {
            return ['status' => 'not_found'];
        }

        $allInGov = $this->placesInGovernorate($governorateId);
        if ($allInGov->isEmpty()) {
            return ['status' => 'not_found'];
        }

        $places = $allInGov->where('category', $category)->values();
        $total = $places->count();

        if ($total < $this->minCategoryPlaces()) {
            return ['status' => 'redirect', 'to' => '/mishwar/'.$governorateId];
        }

        $govNameAr = (string) $gov['name_ar'];
        $categoryLabels = $this->categoryLabels();
        $categoryLabel = $categoryLabels[$category] ?? $category;

        return [
            'status' => 'ok',
            'data' => [
                'governorate' => [
                    'id' => $governorateId,
                    'name_ar' => $govNameAr,
                ],
                'category' => [
                    'key' => $category,
                    'label' => $categoryLabel,
                    'hub_title' => (string) (Facts::placeCategoryHubTitles()[$category] ?? $categoryLabel),
                ],
                'h1' => $this->h1($govNameAr, $category),
                'intro' => $this->intro($total, $govNameAr, $categoryLabel),
                'description' => $this->metaDescription($places, $total, $govNameAr, $categoryLabel),
                'total' => $total,
                'indexable' => true,
                'map_url' => '/mishwar?gov='.$governorateId,
                'governorate_url' => '/governorates/'.$governorateId,
                'hub_url' => '/mishwar/'.$governorateId,
                'categories' => [],
                'places' => $places->map(fn (Place $p) => $this->formatPlace($p, $categoryLabels))->values()->all(),
                'place_items' => $this->itemListEntries($places),
                'other_hubs' => $this->otherIndexableHubs($governorateId),
            ],
        ];
    }

    /**
     * Sitemap entries for every indexable Mishwar governorate and category hub.
     *
     * @return SitemapUrl[]
     */
    public function sitemapHubs(): array
    {
        $govByPlace = $this->governorates->map();
        if ($govByPlace === []) {
            return [];
        }

        $places = Place::query()
            ->where('status', 'approved')
            ->whereIn('id', array_keys($govByPlace))
            ->get(['id', 'category', 'updated_at', 'approved_at']);

        $govStats = [];
        $catStats = [];

        foreach ($places as $place) {
            $govId = $govByPlace[(int) $place->id] ?? null;
            if ($govId === null) {
                continue;
            }

            $ts = $this->placeTimestamp($place);

            $govStats[$govId]['count'] = ($govStats[$govId]['count'] ?? 0) + 1;
            $govStats[$govId]['lastmod'] = $this->maxCarbon($govStats[$govId]['lastmod'] ?? null, $ts);

            $category = (string) $place->category;
            if ($this->isHubCategory($category)) {
                $catStats[$govId][$category]['count'] = ($catStats[$govId][$category]['count'] ?? 0) + 1;
                $catStats[$govId][$category]['lastmod'] = $this->maxCarbon(
                    $catStats[$govId][$category]['lastmod'] ?? null,
                    $ts,
                );
            }
        }

        $minGov = $this->minGovernoratePlaces();
        $minCat = $this->minCategoryPlaces();
        $hubCategories = array_keys(Facts::placeCategoryHubTitles());

        $orderedGovs = Facts::governorates();
        usort($orderedGovs, fn (array $a, array $b) => ((int) $a['sort_order']) <=> ((int) $b['sort_order']));

        $urls = [];
        foreach ($orderedGovs as $gov) {
            $govId = (string) $gov['id'];
            $g = $govStats[$govId] ?? null;
            if ($g !== null && $g['count'] >= $minGov) {
                $urls[] = new SitemapUrl('/mishwar/'.$govId, 0.6, 'weekly', $g['lastmod']);
            }

            foreach ($hubCategories as $catKey) {
                $c = $catStats[$govId][$catKey] ?? null;
                if ($c !== null && $c['count'] >= $minCat) {
                    $urls[] = new SitemapUrl('/mishwar/'.$govId.'/'.$catKey, 0.6, 'weekly', $c['lastmod']);
                }
            }
        }

        return $urls;
    }

    /**
     * Approved places in one governorate, ordered by most saves first, then
     * most recently approved.
     *
     * @return Collection<int, Place>
     */
    private function placesInGovernorate(string $governorateId): Collection
    {
        $map = $this->governorates->map();
        $ids = array_keys(array_filter($map, fn (string $gov): bool => $gov === $governorateId));

        if ($ids === []) {
            return collect();
        }

        return Place::query()
            ->where('status', 'approved')
            ->whereIn('id', $ids)
            ->with(PlaceController::thumbPhotos())
            ->withCount('photos')
            ->orderByDesc('saves_count')
            ->orderByDesc('approved_at')
            ->orderByDesc('id')
            ->get();
    }

    private function h1(string $govNameAr, ?string $category): string
    {
        if ($category === null) {
            return 'أماكن سياحية في '.$govNameAr;
        }

        $hubTitle = Facts::placeCategoryHubTitles()[$category] ?? $category;

        return $hubTitle.' في '.$govNameAr;
    }

    private function intro(int $count, string $govNameAr, ?string $categoryLabel): string
    {
        $countPhrase = $this->countedPlaces($count);
        $verb = match ($count) {
            1 => 'أضافه',
            2 => 'أضافهما',
            default => 'أضافها',
        };

        if ($categoryLabel !== null) {
            return "{$countPhrase} من فئة {$categoryLabel} في {$govNameAr} {$verb} زوار مشوار، مع الصور والموقع.";
        }

        return "{$countPhrase} في {$govNameAr} {$verb} زوار مشوار، مع الصور والموقع.";
    }

    /**
     * @param  Collection<int, Place>  $places
     */
    private function metaDescription(Collection $places, int $count, string $govNameAr, ?string $categoryLabel): string
    {
        $topNames = $places->take(3)->pluck('name')->filter()->values()->all();
        $names = implode('، و', $topNames);
        if ($count > 3 && $names !== '') {
            $names .= '، و…';
        }

        $countPhrase = $this->countedPlaces($count);
        $tail = $categoryLabel !== null
            ? "{$countPhrase} من فئة {$categoryLabel} في {$govNameAr} مع الصور والموقع على مشوار."
            : "{$countPhrase} في {$govNameAr} مع الصور والموقع على مشوار.";

        return $names !== '' ? Arabic::excerpt("{$names} — {$tail}") : $tail;
    }

    private function countedPlaces(int $count): string
    {
        return match ($count) {
            1 => 'مكان واحد',
            2 => 'مكانان',
            default => $count.' '.Arabic::counted($count, [
                'one' => 'مكان',
                'two' => 'مكان',
                'few' => 'أماكن',
                'many' => 'مكاناً',
            ]),
        };
    }

    /**
     * @param  array<string, string>  $categoryLabels
     * @return array<string, mixed>
     */
    private function formatPlace(Place $place, array $categoryLabels): array
    {
        return [
            'id' => (int) $place->id,
            'name' => (string) $place->name,
            'category' => (string) $place->category,
            'category_label' => $categoryLabels[(string) $place->category] ?? (string) $place->category,
            'description' => Arabic::excerpt($place->description, 160),
            'thumb_url' => $place->photos->first()?->thumb_url,
            'photos_count' => (int) ($place->photos_count ?? $place->photos->count()),
            'saves_count' => (int) $place->saves_count,
            'url' => $place->publicPath(),
        ];
    }

    /**
     * @param  Collection<int, Place>  $places
     * @return list<array{name: string, path: string}>
     */
    private function itemListEntries(Collection $places): array
    {
        return $places->map(fn (Place $p) => [
            'name' => (string) $p->name,
            'path' => $p->publicPath(),
        ])->values()->all();
    }

    /**
     * Other governorate hubs that meet the indexability threshold.
     *
     * @return list<array{id: string, name_ar: string, count: int, url: string}>
     */
    private function otherIndexableHubs(string $currentGovId): array
    {
        $counts = array_count_values($this->governorates->map());
        $minGov = $this->minGovernoratePlaces();

        $ordered = Facts::governorates();
        usort($ordered, fn (array $a, array $b) => ((int) $a['sort_order']) <=> ((int) $b['sort_order']));

        $hubs = [];
        foreach ($ordered as $gov) {
            $id = (string) $gov['id'];
            if ($id === $currentGovId) {
                continue;
            }
            $count = $counts[$id] ?? 0;
            if ($count < $minGov) {
                continue;
            }
            $hubs[] = [
                'id' => $id,
                'name_ar' => (string) $gov['name_ar'],
                'count' => $count,
                'url' => '/mishwar/'.$id,
            ];
        }

        return $hubs;
    }

    /** @return array<string, string> */
    private function categoryLabels(): array
    {
        $labels = [];
        foreach (Facts::places()['categories'] as $cat) {
            $labels[(string) $cat['key']] = (string) $cat['label'];
        }

        return $labels;
    }

    private function placeTimestamp(Place $place): ?Carbon
    {
        $candidates = array_filter([$place->updated_at, $place->approved_at]);
        if ($candidates === []) {
            return null;
        }

        $parsed = array_map(fn ($ts) => Carbon::parse($ts), $candidates);

        return max($parsed);
    }

    private function maxCarbon(?Carbon $a, ?Carbon $b): ?Carbon
    {
        if ($a === null) {
            return $b;
        }
        if ($b === null) {
            return $a;
        }

        return $a->greaterThan($b) ? $a : $b;
    }
}
