<?php

namespace App\Services\Places;

use App\Models\Place;
use App\Support\ArabicSearch;
use Illuminate\Support\Collection;

/**
 * Read-only data-quality audit over approved Mishwar places.
 *
 * Surfaces duplicate names (with distance + governorate heuristics so operators
 * can distinguish true duplicates from same-named places in different cities),
 * nearby similar names, Latin-only names, thin noindex pages, and pins falling
 * outside every governorate polygon.
 */
final class PlaceAuditService
{
    public const KIND_DUPLICATE_NAMES = 'duplicate_names';

    public const KIND_NEARBY_SIMILAR = 'nearby_similar';

    public const KIND_LATIN_ONLY_NAMES = 'latin_only_names';

    public const KIND_THIN = 'thin';

    public const KIND_NO_GOVERNORATE = 'no_governorate';

    /** @var list<string> */
    public const KINDS = [
        self::KIND_DUPLICATE_NAMES,
        self::KIND_NEARBY_SIMILAR,
        self::KIND_LATIN_ONLY_NAMES,
        self::KIND_THIN,
        self::KIND_NO_GOVERNORATE,
    ];

    public const VERDICT_DUPLICATE = 'duplicate';

    public const VERDICT_SAME_NAME_DIFFERENT_PLACE = 'same_name_different_place';

    public const VERDICT_CHECK_COORDINATES = 'check_coordinates';

    public const DUPLICATE_MAX_KM = 1.0;

    public const DIFFERENT_PLACE_MIN_KM = 25.0;

    public const NEARBY_SIMILAR_MAX_KM = 0.2;

    public const DEFAULT_LIMIT = 50;

    /** Cheap bounding-box degrees covering 0.2 km at Syria's latitudes (~32–37.5°N). */
    private const NEARBY_LAT_DELTA = 0.002;

    private const NEARBY_LNG_DELTA = 0.003;

    public function __construct(private readonly PlaceGovernorates $governorates) {}

    /**
     * Great-circle distance in kilometres between two WGS84 coordinates.
     */
    public static function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 6371.0 * 2.0 * asin(min(1.0, sqrt($a)));
    }

    /**
     * Pure heuristic for two approved places sharing the same folded name:
     *  - <= 1 km -> "duplicate"
     *  - >= 25 km in different known governorates -> "same_name_different_place"
     *  - everything else (1–25 km, >= 25 km in the same governorate, or unknown governorate) -> "check_coordinates"
     */
    public static function classifyDuplicatePair(
        float $distanceKm,
        ?string $firstGovernorate,
        ?string $memberGovernorate,
    ): string {
        if ($distanceKm <= self::DUPLICATE_MAX_KM) {
            return self::VERDICT_DUPLICATE;
        }

        if (
            $distanceKm >= self::DIFFERENT_PLACE_MIN_KM
            && $firstGovernorate !== null
            && $memberGovernorate !== null
            && $firstGovernorate !== $memberGovernorate
        ) {
            return self::VERDICT_SAME_NAME_DIFFERENT_PLACE;
        }

        return self::VERDICT_CHECK_COORDINATES;
    }

    /**
     * True when the name contains no Arabic letter at all.
     */
    public static function isLatinOnlyName(string $name): bool
    {
        return preg_match('/\p{Arabic}/u', $name) !== 1;
    }

    /**
     * Run the audit across all approved places.
     *
     * @param  list<string>|null  $kinds
     * @return array<string, mixed>
     */
    public function audit(?array $kinds = null, int $limit = self::DEFAULT_LIMIT): array
    {
        $requestedKinds = $kinds === null || $kinds === []
            ? self::KINDS
            : array_values(array_intersect(self::KINDS, $kinds));

        $limit = max(1, $limit);

        $places = Place::query()
            ->where('status', 'approved')
            ->withCount('photos')
            ->orderBy('id')
            ->get(['id', 'name', 'category', 'description', 'lat', 'lng', 'saves_count', 'status']);

        $govMap = $this->governorates->map();

        $counts = [];
        $findings = [];

        foreach ($requestedKinds as $kind) {
            $all = match ($kind) {
                self::KIND_DUPLICATE_NAMES => $this->duplicateNames($places, $govMap),
                self::KIND_NEARBY_SIMILAR => $this->nearbySimilar($places, $govMap),
                self::KIND_LATIN_ONLY_NAMES => $this->latinOnlyNames($places, $govMap),
                self::KIND_THIN => $this->thinPlaces($places, $govMap),
                self::KIND_NO_GOVERNORATE => $this->noGovernorate($places, $govMap),
                default => [],
            };

            $counts[$kind] = count($all);
            $findings[$kind] = array_slice($all, 0, $limit);
        }

        return [
            'approved_places_checked' => $places->count(),
            'limit_per_kind' => $limit,
            'counts' => $counts,
            'findings' => $findings,
        ];
    }

    /**
     * @param  Collection<int, Place>  $places
     * @param  array<int, string>  $govMap
     * @return list<array<string, mixed>>
     */
    private function duplicateNames(Collection $places, array $govMap): array
    {
        /** @var array<string, list<Place>> $grouped */
        $grouped = [];
        foreach ($places as $place) {
            $folded = ArabicSearch::fold((string) $place->name);
            if ($folded === '') {
                continue;
            }
            $grouped[$folded][] = $place;
        }

        $verdictOrder = [
            self::VERDICT_DUPLICATE => 0,
            self::VERDICT_CHECK_COORDINATES => 1,
            self::VERDICT_SAME_NAME_DIFFERENT_PLACE => 2,
        ];

        $groups = [];
        foreach ($grouped as $folded => $members) {
            if (count($members) < 2) {
                continue;
            }

            $first = $members[0];
            $firstGov = $govMap[(int) $first->id] ?? null;

            // For member 0, classify against its closest sibling so a 2-place
            // pair 185 km apart does not falsely label member 0 as "duplicate".
            $closestDist = null;
            $closestGov = null;
            for ($i = 1, $n = count($members); $i < $n; $i++) {
                $other = $members[$i];
                $dist = self::haversineKm(
                    (float) $first->lat,
                    (float) $first->lng,
                    (float) $other->lat,
                    (float) $other->lng,
                );
                if ($closestDist === null || $dist < $closestDist) {
                    $closestDist = $dist;
                    $closestGov = $govMap[(int) $other->id] ?? null;
                }
            }

            $firstLikely = self::classifyDuplicatePair((float) $closestDist, $firstGov, $closestGov);

            $rows = [];
            $groupLikely = self::VERDICT_SAME_NAME_DIFFERENT_PLACE;

            foreach ($members as $index => $member) {
                $memberGov = $govMap[(int) $member->id] ?? null;
                if ($index === 0) {
                    $km = 0.0;
                    $likely = $firstLikely;
                } else {
                    $km = self::haversineKm(
                        (float) $first->lat,
                        (float) $first->lng,
                        (float) $member->lat,
                        (float) $member->lng,
                    );
                    $likely = self::classifyDuplicatePair($km, $firstGov, $memberGov);
                }

                if ($verdictOrder[$likely] < $verdictOrder[$groupLikely]) {
                    $groupLikely = $likely;
                }

                $rows[] = [
                    'id' => (int) $member->id,
                    'name' => (string) $member->name,
                    'category' => (string) $member->category,
                    'governorate' => $memberGov,
                    'photos_count' => (int) ($member->photos_count ?? 0),
                    'saves_count' => (int) $member->saves_count,
                    'word_count' => PlaceIndexability::wordCount($member->description),
                    'lat' => (float) $member->lat,
                    'lng' => (float) $member->lng,
                    'km_from_first' => round($km, 2),
                    'likely' => $likely,
                    'url' => $member->publicPath(),
                ];
            }

            $groups[] = [
                'folded_name' => $folded,
                'count' => count($rows),
                'likely' => $groupLikely,
                'members' => $rows,
            ];
        }

        usort($groups, function (array $a, array $b) use ($verdictOrder): int {
            $cmp = $verdictOrder[$a['likely']] <=> $verdictOrder[$b['likely']];

            return $cmp !== 0 ? $cmp : ($a['members'][0]['id'] <=> $b['members'][0]['id']);
        });

        return $groups;
    }

    /**
     * @param  Collection<int, Place>  $places
     * @param  array<int, string>  $govMap
     * @return list<array<string, mixed>>
     */
    private function nearbySimilar(Collection $places, array $govMap): array
    {
        $prepared = [];
        foreach ($places as $place) {
            $fold = ArabicSearch::fold((string) $place->name);
            if (mb_strlen($fold) < 2) {
                continue;
            }
            $prepared[] = [
                'place' => $place,
                'fold' => $fold,
                'lat' => (float) $place->lat,
                'lng' => (float) $place->lng,
            ];
        }

        usort($prepared, fn (array $a, array $b): int => $a['lat'] <=> $b['lat']);

        $pairs = [];
        $count = count($prepared);

        for ($i = 0; $i < $count; $i++) {
            $a = $prepared[$i];

            for ($j = $i + 1; $j < $count; $j++) {
                $b = $prepared[$j];

                if ($b['lat'] - $a['lat'] > self::NEARBY_LAT_DELTA) {
                    break;
                }

                if (abs($b['lng'] - $a['lng']) > self::NEARBY_LNG_DELTA) {
                    continue;
                }

                if ($a['fold'] === $b['fold']) {
                    continue;
                }

                if (! str_contains($a['fold'], $b['fold']) && ! str_contains($b['fold'], $a['fold'])) {
                    continue;
                }

                $km = self::haversineKm($a['lat'], $a['lng'], $b['lat'], $b['lng']);
                if ($km > self::NEARBY_SIMILAR_MAX_KM) {
                    continue;
                }

                /** @var Place $first */
                /** @var Place $second */
                [$first, $second] = $a['place']->id < $b['place']->id
                    ? [$a['place'], $b['place']]
                    : [$b['place'], $a['place']];

                $pairs[] = [
                    'distance_km' => round($km, 3),
                    'places' => [
                        $this->placeSummary($first, $govMap),
                        $this->placeSummary($second, $govMap),
                    ],
                ];
            }
        }

        usort($pairs, fn (array $a, array $b): int => [$a['distance_km'], $a['places'][0]['id']] <=> [$b['distance_km'], $b['places'][0]['id']]);

        return $pairs;
    }

    /**
     * @param  Collection<int, Place>  $places
     * @param  array<int, string>  $govMap
     * @return list<array<string, mixed>>
     */
    private function latinOnlyNames(Collection $places, array $govMap): array
    {
        $items = [];
        foreach ($places as $place) {
            if (! self::isLatinOnlyName((string) $place->name)) {
                continue;
            }

            $items[] = $this->placeSummary($place, $govMap);
        }

        return $items;
    }

    /**
     * @param  Collection<int, Place>  $places
     * @param  array<int, string>  $govMap
     * @return list<array<string, mixed>>
     */
    private function thinPlaces(Collection $places, array $govMap): array
    {
        $items = [];
        foreach ($places as $place) {
            $photosCount = (int) ($place->photos_count ?? 0);
            if (! PlaceIndexability::isThin($place, $photosCount)) {
                continue;
            }

            $items[] = [
                'id' => (int) $place->id,
                'name' => (string) $place->name,
                'category' => (string) $place->category,
                'governorate' => $govMap[(int) $place->id] ?? null,
                'word_count' => PlaceIndexability::wordCount($place->description),
                'photos_count' => $photosCount,
                'saves_count' => (int) $place->saves_count,
                'url' => $place->publicPath(),
            ];
        }

        return $items;
    }

    /**
     * @param  Collection<int, Place>  $places
     * @param  array<int, string>  $govMap
     * @return list<array<string, mixed>>
     */
    private function noGovernorate(Collection $places, array $govMap): array
    {
        $items = [];
        foreach ($places as $place) {
            if (isset($govMap[(int) $place->id])) {
                continue;
            }

            $items[] = [
                'id' => (int) $place->id,
                'name' => (string) $place->name,
                'category' => (string) $place->category,
                'governorate' => null,
                'lat' => (float) $place->lat,
                'lng' => (float) $place->lng,
                'photos_count' => (int) ($place->photos_count ?? 0),
                'saves_count' => (int) $place->saves_count,
                'url' => $place->publicPath(),
            ];
        }

        return $items;
    }

    /**
     * @param  array<int, string>  $govMap
     * @return array<string, mixed>
     */
    private function placeSummary(Place $place, array $govMap): array
    {
        return [
            'id' => (int) $place->id,
            'name' => (string) $place->name,
            'category' => (string) $place->category,
            'governorate' => $govMap[(int) $place->id] ?? null,
            'photos_count' => (int) ($place->photos_count ?? 0),
            'saves_count' => (int) $place->saves_count,
            'word_count' => PlaceIndexability::wordCount($place->description),
            'lat' => (float) $place->lat,
            'lng' => (float) $place->lng,
            'url' => $place->publicPath(),
        ];
    }
}
