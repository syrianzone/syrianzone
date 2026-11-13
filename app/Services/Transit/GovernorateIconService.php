<?php

namespace App\Services\Transit;

use App\Support\Facts;

/**
 * Governorate outline icons for the public transit API.
 *
 * The outlines are authored as individual SVG files under
 * resources/js/Pages/Transit/_data/governorates/, and the landing CityCard
 * imports them for the browser via import.meta.glob. The API needs the same
 * shapes, so instead of a second hand-maintained copy they are reduced once to
 * `{viewBox, path}` in resources/data/governorate-icons.json — enough for a
 * client to draw the icon with fill=currentColor — and read from the shared fact
 * store here, so no PHP code reads the frontend tree.
 * tests/Feature/GovernorateIconFactsTest.php fails when the two copies drift.
 */
class GovernorateIconService
{
    /** @var array<string, array{viewBox: string, path: string}|null> */
    private array $resolved = [];

    /**
     * @return array{viewBox: string, path: string}|null Null when no outline exists for the id.
     */
    public function forCity(string $cityId): ?array
    {
        if (array_key_exists($cityId, $this->resolved)) {
            return $this->resolved[$cityId];
        }

        // City ids, the spellings the importer and admin UI use, and the outline
        // key all come from the shared governorate table; CityCard.tsx resolves
        // the browser side of the same mapping from it.
        $row = Facts::governorateByAnyName($cityId);
        $file = $row['transit_svg'] ?? $cityId;

        return $this->resolved[$cityId] = Facts::governorateIcon($file);
    }
}
