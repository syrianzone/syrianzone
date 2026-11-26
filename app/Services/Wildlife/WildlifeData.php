<?php

namespace App\Services\Wildlife;

use App\Support\Facts;

/**
 * Builds the props of `/wild` and `/wild/{slug}` from
 * `resources/data/wildlife.json`, so each page receives only what it renders
 * instead of the whole guide shipping in the JavaScript bundle.
 */
final class WildlifeData
{
    /** How many other species a species page links to. */
    private const RELATED = 3;

    /** The Red List's "threatened" categories. */
    private const THREATENED = ['CR', 'EN', 'VU'];

    /** Statuses for which a governorate's records are historical. */
    private const GONE = ['possibly-extinct', 'extinct-in-syria'];

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return array_values(Facts::json('wildlife')['species'] ?? []);
    }

    /** @return array<string, mixed>|null */
    public function find(string $slug): ?array
    {
        foreach ($this->all() as $species) {
            if (($species['slug'] ?? null) === $slug) {
                return $species;
            }
        }

        return null;
    }

    /**
     * The hub: a card per species, the headline counts and the main references.
     *
     * @return array{species: list<array<string, mixed>>, stats: array{total: int, threatened: int, sources: int}, sources: list<array{title: string, url: string}>}
     */
    public function forHub(): array
    {
        $all = $this->all();
        $urls = [];
        foreach ($all as $species) {
            foreach ($species['sources'] as $source) {
                $urls[$source['url']] = true;
            }
        }

        return [
            'species' => array_map(self::card(...), $all),
            'stats' => [
                'total' => count($all),
                'threatened' => count(array_filter($all, fn (array $s): bool => in_array($s['iucn']['category'], self::THREATENED, true))),
                'sources' => count($urls),
            ],
            'sources' => array_values(Facts::json('wildlife')['meta']['sources'] ?? []),
        ];
    }

    /**
     * One species page: the full record and the cards of the species it links to.
     *
     * @return array{species: array<string, mixed>, related: list<array<string, mixed>>}|null
     */
    public function forSpecies(string $slug): ?array
    {
        $species = $this->find($slug);
        if ($species === null) {
            return null;
        }

        return [
            'species' => $species,
            'related' => array_map(self::card(...), $this->related($species)),
        ];
    }

    /**
     * The species with a documented record in a governorate, for its page.
     *
     * @return list<array{slug: string, nameAr: string, group: string, syriaStatus: string, historical: bool, url: string}>
     */
    public function forGovernorate(string $governorateId): array
    {
        $matched = [];
        foreach ($this->all() as $species) {
            if (! in_array($governorateId, $species['governorates'] ?? [], true)) {
                continue;
            }
            $matched[] = [
                'slug' => (string) $species['slug'],
                'nameAr' => (string) $species['nameAr'],
                'group' => (string) $species['group'],
                'syriaStatus' => (string) $species['syriaStatus'],
                'historical' => in_array($species['syriaStatus'], self::GONE, true),
                'url' => '/wild/'.$species['slug'],
            ];
        }

        return $matched;
    }

    /**
     * What a card in a grid needs, and nothing more.
     *
     * @param  array<string, mixed>  $species
     * @return array<string, mixed>
     */
    public static function card(array $species): array
    {
        return array_filter([
            'slug' => $species['slug'],
            'nameAr' => $species['nameAr'],
            'altNamesAr' => $species['altNamesAr'] ?? [],
            'nameEn' => $species['nameEn'],
            'scientific' => $species['scientific'],
            'subspecies' => $species['subspecies'] ?? null,
            'group' => $species['group'],
            'iucn' => ['category' => $species['iucn']['category']],
            'syriaStatus' => $species['syriaStatus'],
            'image' => [
                'commonsFile' => $species['image']['commonsFile'],
                'r2Key' => $species['image']['r2Key'] ?? null,
            ],
        ], fn (mixed $v): bool => $v !== null);
    }

    /**
     * The species that follow this one in its group, wrapping round, so every
     * page in a group is linked from others instead of all linking to its
     * first few; topped up from the other groups when the group is small.
     *
     * @param  array<string, mixed>  $species
     * @return list<array<string, mixed>>
     */
    private function related(array $species): array
    {
        $all = $this->all();
        $index = array_search($species['slug'], array_column($all, 'slug'), true);
        $rotated = array_merge(array_slice($all, $index + 1), array_slice($all, 0, $index));

        $same = array_values(array_filter($rotated, fn (array $o): bool => $o['group'] === $species['group']));
        $other = array_values(array_filter($rotated, fn (array $o): bool => $o['group'] !== $species['group']));

        return array_slice([...$same, ...$other], 0, self::RELATED);
    }
}
