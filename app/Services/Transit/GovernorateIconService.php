<?php

namespace App\Services\Transit;

use App\Support\Facts;

/**
 * Governorate outline icons for the public transit API.
 *
 * The outlines are authored as individual SVG files under
 * resources/js/Pages/Transit/_data/governorates/, and the landing CityCard
 * imports them for the browser via import.meta.glob. The API needs the same
 * shapes, so instead of a second hand-maintained copy this reads those exact
 * files and returns the viewBox plus the first path's `d`: enough for a client
 * to draw the icon with fill=currentColor. The parsing mirrors
 * governorate_svgs.ts so both sides stay identical.
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

        // City ids, the spellings the importer and admin UI use, and the SVG
        // basename all come from the shared governorate table; CityCard.tsx
        // resolves the browser side of the same mapping from it.
        $row = Facts::governorateByAnyName($cityId);
        $file = $row['transit_svg'] ?? $cityId;
        $absolute = resource_path("js/Pages/Transit/_data/governorates/{$file}.svg");

        if (! is_file($absolute)) {
            return $this->resolved[$cityId] = null;
        }

        $raw = (string) file_get_contents($absolute);
        if (preg_match('/viewBox="([^"]+)"/', $raw, $viewBox) !== 1
            || preg_match('/d="([^"]+)"/', $raw, $path) !== 1) {
            return $this->resolved[$cityId] = null;
        }

        return $this->resolved[$cityId] = [
            'viewBox' => $viewBox[1],
            'path' => $path[1],
        ];
    }
}
