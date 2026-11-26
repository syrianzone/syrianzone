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

    /** @var array{minLon: float, maxLon: float, minLat: float, maxLat: float, cosLat: float, pad: float, width: int, height: int, scale: float}|null */
    private static ?array $projection = null;

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
     * Lat/lng bounding box `[[minLng, minLat], [maxLng, maxLat]]` for one governorate,
     * suitable for MapLibre `fitBounds`, or null when the governorate is unknown.
     *
     * @return array{0: array{0: float, 1: float}, 1: array{0: float, 1: float}}|null
     */
    public function latLngBounds(string $governorateId): ?array
    {
        foreach ($this->features() as $feature) {
            if ($feature['id'] !== $governorateId) {
                continue;
            }

            $minLon = INF;
            $maxLon = -INF;
            $minLat = INF;
            $maxLat = -INF;

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

            if ($minLon === INF) {
                return null;
            }

            return [
                [round($minLon, 6), round($minLat, 6)],
                [round($maxLon, 6), round($maxLat, 6)],
            ];
        }

        return null;
    }

    /**
     * Server-rendered locator map payload for a Mishwar place, zoomed to the
     * place's governorate (with padding and a minimum span for small governorates
     * like Damascus or Quneitra so surrounding governorates stay visible).
     *
     * @return array{
     *     viewBox: string,
     *     fullViewBox: string,
     *     width: int,
     *     height: int,
     *     shapes: list<array{id: string, name_ar: string, path: string, label_x: float, label_y: float}>,
     *     pin: array{x: float, y: float}
     * }|null
     */
    public function locatorForPlace(float $lat, float $lng, ?string $governorateId): ?array
    {
        $svgMap = $this->svgMap();
        $pin = $this->projectPoint($lat, $lng);

        if ($pin === null || $svgMap['shapes'] === []) {
            return null;
        }

        $zoom = $this->zoomedBounds($governorateId, $pin);
        $viewBox = $zoom['viewBox'] ?? $svgMap['viewBox'];
        $proj = $this->projection();

        $shapes = $svgMap['shapes'];
        if ($zoom !== null && $proj !== null && $zoom['w'] < 160.0) {
            $minDist = max(0.2, min(1.1, $zoom['w'] / 150.0));
            $shapes = $this->buildShapes($proj, $minDist);
        }

        if ($zoom !== null && $proj !== null && $governorateId === 'damascus') {
            $ruralAnchor = $this->placeRuralDamascusLabel($zoom, $pin, $proj);
            if ($ruralAnchor !== null) {
                $shapes = array_map(static function (array $s) use ($ruralAnchor): array {
                    if ($s['id'] === 'rural-damascus') {
                        $s['label_x'] = $ruralAnchor['x'];
                        $s['label_y'] = $ruralAnchor['y'];
                    }

                    return $s;
                }, $shapes);
            }
        }

        return [
            'viewBox' => $viewBox,
            'fullViewBox' => $svgMap['viewBox'],
            'width' => $svgMap['width'],
            'height' => $svgMap['height'],
            'shapes' => array_map(static fn (array $s) => [
                'id' => $s['id'],
                'name_ar' => $s['name_ar'],
                'path' => $s['path'],
                'label_x' => $s['label_x'],
                'label_y' => $s['label_y'],
            ], $shapes),
            'pin' => $pin,
        ];
    }

    /**
     * Compute a zoomed 4:3 SVG viewBox centered on the governorate (plus the pin)
     * in `svgMap()` coordinates, using an adaptive minimum span so tiny governorates
     * like Damascus zoom in while keeping neighbouring context.
     *
     * @param  array{x: float, y: float}  $pin
     * @return array{viewBox: string, x0: float, y0: float, w: float, h: float, rawMinX: float, rawMaxX: float, rawMinY: float, rawMaxY: float}|null
     */
    private function zoomedBounds(?string $governorateId, array $pin): ?array
    {
        if ($governorateId === null) {
            return null;
        }

        $proj = $this->projection();
        if ($proj === null) {
            return null;
        }

        $targetFeature = null;
        foreach ($this->features() as $feature) {
            if ($feature['id'] === $governorateId) {
                $targetFeature = $feature;
                break;
            }
        }
        if ($targetFeature === null) {
            return null;
        }

        $minX = $pin['x'];
        $maxX = $pin['x'];
        $minY = $pin['y'];
        $maxY = $pin['y'];

        foreach ($targetFeature['polygons'] as $polygon) {
            foreach ($polygon as $ring) {
                foreach ($ring as $pt) {
                    $x = $proj['pad'] + ($pt[0] - $proj['minLon']) * $proj['cosLat'] * $proj['scale'];
                    $y = $proj['pad'] + ($proj['maxLat'] - $pt[1]) * $proj['scale'];
                    if ($x < $minX) {
                        $minX = $x;
                    }
                    if ($x > $maxX) {
                        $maxX = $x;
                    }
                    if ($y < $minY) {
                        $minY = $y;
                    }
                    if ($y > $maxY) {
                        $maxY = $y;
                    }
                }
            }
        }

        $rawW = $maxX - $minX;
        $rawH = $maxY - $minY;
        $maxDim = max($rawW, $rawH);

        $padX = max(min(14.0, $maxDim * 0.45), $rawW * 0.22);
        $padY = max(min(12.0, $maxDim * 0.40), $rawH * 0.22);

        $aspect = 4.0 / 3.0;
        $minW = max(28.0, min(96.0, $maxDim * 2.5));
        $minH = $minW / $aspect;
        $w = max($rawW + 2 * $padX, $minW);
        $h = max($rawH + 2 * $padY, $minH);

        if (($w / $h) < $aspect) {
            $w = $h * $aspect;
        } else {
            $h = $w / $aspect;
        }

        $cx = ($minX + $maxX) / 2.0;
        $cy = ($minY + $maxY) / 2.0;
        $x0 = round($cx - $w / 2.0, 1);
        $y0 = round($cy - $h / 2.0, 1);
        $wRounded = round($w, 1);
        $hRounded = round($h, 1);

        return [
            'viewBox' => sprintf('%.1f %.1f %.1f %.1f', $x0, $y0, $wRounded, $hRounded),
            'x0' => $x0,
            'y0' => $y0,
            'w' => $wRounded,
            'h' => $hRounded,
            'rawMinX' => $minX,
            'rawMaxX' => $maxX,
            'rawMinY' => $minY,
            'rawMaxY' => $maxY,
        ];
    }

    /**
     * Find an in-view label anchor for Rural Damascus when zoomed on Damascus city,
     * staying inside Rural Damascus, outside Damascus, away from the pin, and clear
     * of the top-end inset and viewBox edges.
     *
     * @param  array{viewBox: string, x0: float, y0: float, w: float, h: float, rawMinX: float, rawMaxX: float, rawMinY: float, rawMaxY: float}  $zoom
     * @param  array{x: float, y: float}  $pin
     * @param  array{minLon: float, maxLon: float, minLat: float, maxLat: float, cosLat: float, pad: float, width: int, height: int, scale: float}  $proj
     * @return array{x: float, y: float}|null
     */
    private function placeRuralDamascusLabel(array $zoom, array $pin, array $proj): ?array
    {
        $rural = null;
        $damascus = null;
        foreach ($this->features() as $feature) {
            if ($feature['id'] === 'rural-damascus') {
                $rural = $feature;
            } elseif ($feature['id'] === 'damascus') {
                $damascus = $feature;
            }
        }
        if ($rural === null) {
            return null;
        }

        $vx = $zoom['x0'];
        $vy = $zoom['y0'];
        $vw = $zoom['w'];
        $vh = $zoom['h'];
        $unitScale = $vw / 300.0;
        // "ريف دمشق" is 8 chars; match Show.tsx labelHalfSize() clearance.
        $hw = 23.0 * $unitScale;
        $hh = 7.6 * $unitScale;
        $pinClear = 14.0 * $unitScale;
        $insetMaxX = $vx + $vw * 0.28;
        $insetMaxY = $vy + $vh * 0.34;

        $best = null;
        $bestScore = -INF;

        for ($gx = 1; $gx <= 9; $gx++) {
            $cx = $vx + ($vw * $gx) / 10.0;
            if ($cx - $hw < $vx + $vw * 0.04 || $cx + $hw > $vx + $vw * 0.96) {
                continue;
            }
            for ($gy = 1; $gy <= 9; $gy++) {
                $cy = $vy + ($vh * $gy) / 10.0;
                if ($cy - $hh < $vy + $vh * 0.06 || $cy + $hh > $vy + $vh * 0.94) {
                    continue;
                }
                if ($cx - $hw < $insetMaxX && $cy - $hh < $insetMaxY) {
                    continue;
                }
                $nearX = max($cx - $hw, min($pin['x'], $cx + $hw));
                $nearY = max($cy - $hh, min($pin['y'], $cy + $hh));
                $pinDist = hypot($pin['x'] - $nearX, $pin['y'] - $nearY);
                if ($pinDist < $pinClear) {
                    continue;
                }

                $lon = $proj['minLon'] + ($cx - $proj['pad']) / ($proj['cosLat'] * $proj['scale']);
                $lat = $proj['maxLat'] - ($cy - $proj['pad']) / $proj['scale'];

                if (! $this->pointInMultiPolygon($lon, $lat, $rural['polygons'])) {
                    continue;
                }
                if ($damascus !== null && $this->pointInMultiPolygon($lon, $lat, $damascus['polygons'])) {
                    continue;
                }

                // Distance outside Damascus's bounding box so the label sits clearly in Rural Damascus.
                $dxDam = max($zoom['rawMinX'] - $cx, 0.0, $cx - $zoom['rawMaxX']);
                $dyDam = max($zoom['rawMinY'] - $cy, 0.0, $cy - $zoom['rawMaxY']);
                $damDist = hypot($dxDam, $dyDam);
                if ($damDist < 1.2 * $unitScale * 10.0) {
                    continue;
                }

                // Prefer east/south/north clear area away from the pin.
                $score = $pinDist + $damDist * 0.5;
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $best = ['x' => round($cx, 1), 'y' => round($cy, 1)];
                }
            }
        }

        return $best;
    }

    /**
     * Project a (lat, lng) coordinate into the same SVG coordinate space used by `svgMap()`.
     * Returns null when geometry is unavailable or the point falls outside Syria's SVG bounds.
     *
     * @return array{x: float, y: float}|null
     */
    public function projectPoint(float $lat, float $lng): ?array
    {
        $proj = $this->projection();
        if ($proj === null) {
            return null;
        }

        $x = $proj['pad'] + ($lng - $proj['minLon']) * $proj['cosLat'] * $proj['scale'];
        $y = $proj['pad'] + ($proj['maxLat'] - $lat) * $proj['scale'];

        if ($x < 0 || $x > $proj['width'] || $y < 0 || $y > $proj['height']) {
            return null;
        }

        return [
            'x' => round($x, 1),
            'y' => round($y, 1),
        ];
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
        $proj = $this->projection();
        if ($features === [] || $proj === null) {
            return self::$svgMap = [
                'viewBox' => '0 0 600 520',
                'width' => 600,
                'height' => 520,
                'shapes' => [],
            ];
        }

        $width = $proj['width'];
        $height = $proj['height'];

        return self::$svgMap = [
            'viewBox' => "0 0 {$width} {$height}",
            'width' => $width,
            'height' => $height,
            'shapes' => $this->buildShapes($proj, 1.1),
        ];
    }

    /**
     * Project and simplify all governorate polygons into SVG shape descriptors.
     *
     * @param  array{minLon: float, maxLon: float, minLat: float, maxLat: float, cosLat: float, pad: float, width: int, height: int, scale: float}  $proj
     * @return list<array{id: string, name_ar: string, path: string, label_x: float, label_y: float}>
     */
    private function buildShapes(array $proj, float $minDist): array
    {
        $features = $this->features();
        if ($features === []) {
            return [];
        }

        $precision = $minDist < 0.5 ? 2 : 1;
        $project = static function (float $lon, float $lat) use ($proj, $precision): array {
            $x = $proj['pad'] + ($lon - $proj['minLon']) * $proj['cosLat'] * $proj['scale'];
            $y = $proj['pad'] + ($proj['maxLat'] - $lat) * $proj['scale'];

            return [round($x, $precision), round($y, $precision)];
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
                    $simplified = $this->simplifyPoints($projected, $minDist);
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

        return $shapes;
    }

    /**
     * Shared equirectangular projection bounds and scale for `svgMap()` and `projectPoint()`.
     *
     * @return array{minLon: float, maxLon: float, minLat: float, maxLat: float, cosLat: float, pad: float, width: int, height: int, scale: float}|null
     */
    private function projection(): ?array
    {
        if (self::$projection !== null) {
            return self::$projection;
        }

        $features = $this->features();
        if ($features === []) {
            return null;
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

        return self::$projection = [
            'minLon' => $minLon,
            'maxLon' => $maxLon,
            'minLat' => $minLat,
            'maxLat' => $maxLat,
            'cosLat' => $cosLat,
            'pad' => $pad,
            'width' => $width,
            'height' => $height,
            'scale' => $scale,
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
