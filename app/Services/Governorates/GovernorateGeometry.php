<?php

namespace App\Services\Governorates;

use App\Support\Facts;

/**
 * Reads the site's shipped OCHA COD-AB admin-1 GeoJSON
 * (`public/assets/population/syr_admin1_opt.geojson`) to:
 *  - classify coordinates (border crossings, Mishwar places) into one of the 14 governorates,
 *  - expose each governorate's area in km²,
 *  - project simplified SVG paths for a server-rendered Syria map with real links.
 */
final class GovernorateGeometry
{
    private const GEOJSON_RELATIVE_PATH = 'assets/population/syr_admin1_opt.geojson';

    /** @var list<array{id: string, pcode: string, area_sqkm: ?float, center_lat: float, center_lon: float, polygons: list<list<list<array{0: float, 1: float}>>>}>|null */
    private static ?array $features = null;

    /** @var array{viewBox: string, width: int, height: int, shapes: list<array{id: string, name_ar: string, path: string, label_x: float, label_y: float}>}|null */
    private static ?array $svgMap = null;

    /**
     * Resolve a (lat, lng) coordinate to a governorate id from `Facts::governorates()`.
     * Falls back to the nearest polygon vertex within `$nearestMaxDegrees` (~5.5 km at 0.05°)
     * so border crossings and coastal ports right on the perimeter still match accurately.
     */
    public function governorateIdForPoint(float $lat, float $lng, float $nearestMaxDegrees = 0.05): ?string
    {
        $features = $this->features();

        foreach ($features as $feature) {
            if ($this->pointInMultiPolygon($lng, $lat, $feature['polygons'])) {
                return $feature['id'];
            }
        }

        if ($nearestMaxDegrees <= 0) {
            return null;
        }

        $bestId = null;
        $bestDistSq = $nearestMaxDegrees * $nearestMaxDegrees;

        foreach ($features as $feature) {
            foreach ($feature['polygons'] as $polygon) {
                $outer = $polygon[0] ?? [];
                foreach ($outer as $pt) {
                    $dx = $pt[0] - $lng;
                    $dy = $pt[1] - $lat;
                    $dSq = $dx * $dx + $dy * $dy;
                    if ($dSq < $bestDistSq) {
                        $bestDistSq = $dSq;
                        $bestId = $feature['id'];
                    }
                }
            }
        }

        return $bestId;
    }

    /**
     * Area in km² from the OCHA COD-AB GeoJSON feature properties, rounded to the nearest integer.
     */
    public function areaSqKm(string $governorateId): ?int
    {
        foreach ($this->features() as $feature) {
            if ($feature['id'] === $governorateId && $feature['area_sqkm'] !== null) {
                return (int) round($feature['area_sqkm']);
            }
        }

        return null;
    }

    /**
     * Server-rendered SVG Syria map geometry: one `<path d="...">` + label anchor per governorate
     * projected into a shared viewBox so the hub renders a crisp interactive map without client JS.
     *
     * @return array{viewBox: string, width: int, height: int, shapes: list<array{id: string, name_ar: string, path: string, label_x: float, label_y: float}>}
     */
    public function svgMap(): array
    {
        if (self::$svgMap !== null) {
            return self::$svgMap;
        }

        $features = $this->features();
        if ($features === []) {
            return self::$svgMap = [
                'viewBox' => '0 0 600 520',
                'width' => 600,
                'height' => 520,
                'shapes' => [],
            ];
        }

        $minLon = INF;
        $maxLon = -INF;
        $minLat = INF;
        $maxLat = -INF;

        foreach ($features as $feature) {
            foreach ($feature['polygons'] as $polygon) {
                foreach ($polygon as $ring) {
                    foreach ($ring as $pt) {
                        if ($pt[0] < $minLon) {
                            $minLon = $pt[0];
                        }
                        if ($pt[0] > $maxLon) {
                            $maxLon = $pt[0];
                        }
                        if ($pt[1] < $minLat) {
                            $minLat = $pt[1];
                        }
                        if ($pt[1] > $maxLat) {
                            $maxLat = $pt[1];
                        }
                    }
                }
            }
        }

        // Aspect-corrected equirectangular projection around Syria's midpoint (~35°N).
        $cosLat = cos(deg2rad(($minLat + $maxLat) / 2.0));
        $pad = 16.0;
        $width = 600;
        $spanX = ($maxLon - $minLon) * $cosLat;
        $spanY = $maxLat - $minLat;
        $scale = ($width - 2 * $pad) / max($spanX, 1e-6);
        $height = (int) ceil($spanY * $scale + 2 * $pad);

        $project = static function (float $lon, float $lat) use ($minLon, $maxLat, $cosLat, $scale, $pad): array {
            $x = $pad + ($lon - $minLon) * $cosLat * $scale;
            $y = $pad + ($maxLat - $lat) * $scale;

            return [round($x, 1), round($y, 1)];
        };

        // Keep Damascus on top of Rif Dimashq so its smaller polygon stays clickable.
        usort($features, static function (array $a, array $b): int {
            if ($a['id'] === 'damascus') {
                return 1;
            }
            if ($b['id'] === 'damascus') {
                return -1;
            }

            return ($b['area_sqkm'] ?? 0) <=> ($a['area_sqkm'] ?? 0);
        });

        $shapes = [];
        foreach ($features as $feature) {
            $gov = Facts::governorate($feature['id']);
            if ($gov === null) {
                continue;
            }

            $pathParts = [];
            foreach ($feature['polygons'] as $polygon) {
                foreach ($polygon as $ring) {
                    $projected = [];
                    foreach ($ring as $pt) {
                        $projected[] = $project($pt[0], $pt[1]);
                    }
                    $simplified = $this->simplifyPoints($projected, 1.1);
                    if (count($simplified) < 3) {
                        continue;
                    }
                    $first = $simplified[0];
                    $segment = 'M'.$first[0].' '.$first[1];
                    for ($i = 1, $n = count($simplified); $i < $n; $i++) {
                        $segment .= 'L'.$simplified[$i][0].' '.$simplified[$i][1];
                    }
                    $pathParts[] = $segment.'Z';
                }
            }

            if ($pathParts === []) {
                continue;
            }

            [$lx, $ly] = $project($feature['center_lon'], $feature['center_lat']);

            // Slight label nudges where Damascus sits inside Rif Dimashq.
            if ($feature['id'] === 'rural-damascus') {
                $lx = round($lx + 24, 1);
                $ly = round($ly + 6, 1);
            }

            $shapes[] = [
                'id' => $feature['id'],
                'name_ar' => (string) $gov['name_ar'],
                'path' => implode(' ', $pathParts),
                'label_x' => $lx,
                'label_y' => $ly,
            ];
        }

        return self::$svgMap = [
            'viewBox' => "0 0 {$width} {$height}",
            'width' => $width,
            'height' => $height,
            'shapes' => $shapes,
        ];
    }

    /**
     * @return list<array{id: string, pcode: string, area_sqkm: ?float, center_lat: float, center_lon: float, polygons: list<list<list<array{0: float, 1: float}>>>}>
     */
    private function features(): array
    {
        if (self::$features !== null) {
            return self::$features;
        }

        $path = public_path(self::GEOJSON_RELATIVE_PATH);
        if (! is_file($path)) {
            return self::$features = [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        if (! is_array($decoded) || ! is_array($decoded['features'] ?? null)) {
            return self::$features = [];
        }

        $pcodeToId = [];
        foreach (Facts::governorates() as $gov) {
            $pcodeToId[(string) $gov['pcode']] = (string) $gov['id'];
        }

        $parsed = [];
        foreach ($decoded['features'] as $feature) {
            $props = $feature['properties'] ?? [];
            $geom = $feature['geometry'] ?? [];
            $pcode = (string) ($props['ADM1_PCODE'] ?? $props['adm1_pcode'] ?? '');
            $id = $pcodeToId[$pcode] ?? null;
            if ($id === null) {
                $gov = Facts::governorateByAnyName((string) ($props['province_name'] ?? $props['ADM1_AR'] ?? ''));
                $id = $gov !== null ? (string) $gov['id'] : null;
            }
            if ($id === null || ! is_array($geom['coordinates'] ?? null)) {
                continue;
            }

            $type = (string) ($geom['type'] ?? '');
            $polygons = [];
            if ($type === 'Polygon') {
                $polygons = [$geom['coordinates']];
            } elseif ($type === 'MultiPolygon') {
                $polygons = $geom['coordinates'];
            } else {
                continue;
            }

            $parsed[] = [
                'id' => $id,
                'pcode' => $pcode,
                'area_sqkm' => isset($props['area_sqkm']) ? (float) $props['area_sqkm'] : null,
                'center_lat' => (float) ($props['center_lat'] ?? (Facts::governorate($id)['lat'] ?? 35.0)),
                'center_lon' => (float) ($props['center_lon'] ?? (Facts::governorate($id)['lng'] ?? 38.0)),
                'polygons' => $polygons,
            ];
        }

        return self::$features = $parsed;
    }

    /**
     * @param  list<list<list<array{0: float, 1: float}>>>  $polygons
     */
    private function pointInMultiPolygon(float $lon, float $lat, array $polygons): bool
    {
        foreach ($polygons as $polygon) {
            $outer = $polygon[0] ?? [];
            if (! $this->pointInRing($lon, $lat, $outer)) {
                continue;
            }

            $inHole = false;
            for ($h = 1, $hn = count($polygon); $h < $hn; $h++) {
                if ($this->pointInRing($lon, $lat, $polygon[$h])) {
                    $inHole = true;
                    break;
                }
            }

            if (! $inHole) {
                return true;
            }
        }

        return false;
    }

    /**
     * Ray-casting point-in-ring test.
     *
     * @param  list<array{0: float, 1: float}>  $ring
     */
    private function pointInRing(float $lon, float $lat, array $ring): bool
    {
        $n = count($ring);
        if ($n < 3) {
            return false;
        }

        $inside = false;
        $j = $n - 1;

        for ($i = 0; $i < $n; $i++) {
            $xi = (float) $ring[$i][0];
            $yi = (float) $ring[$i][1];
            $xj = (float) $ring[$j][0];
            $yj = (float) $ring[$j][1];

            $intersects = (($yi > $lat) !== ($yj > $lat))
                && ($lon < ($xj - $xi) * ($lat - $yi) / (($yj - $yi) ?: 1e-15) + $xi);

            if ($intersects) {
                $inside = ! $inside;
            }

            $j = $i;
        }

        return $inside;
    }

    /**
     * Radial-distance vertex decimation in SVG pixel space so the SSR map stays compact.
     *
     * @param  list<array{0: float, 1: float}>  $points
     * @return list<array{0: float, 1: float}>
     */
    private function simplifyPoints(array $points, float $minDist): array
    {
        $count = count($points);
        if ($count <= 4) {
            return $points;
        }

        $minDistSq = $minDist * $minDist;
        $out = [$points[0]];
        $last = $points[0];

        for ($i = 1; $i < $count - 1; $i++) {
            $dx = $points[$i][0] - $last[0];
            $dy = $points[$i][1] - $last[1];
            if (($dx * $dx + $dy * $dy) >= $minDistSq) {
                $out[] = $points[$i];
                $last = $points[$i];
            }
        }

        return $out;
    }
}
