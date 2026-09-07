<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use ZipArchive;

/**
 * Google My Maps (maps/d?mid=...) -> internal route_drafts.geojson converter.
 *
 * Pure parsing lives here so it stays unit-testable without HTTP or DB.
 * Network fetching is a thin wrapper that only interpolates a validated
 * `mid` into allow-listed Google KML hosts (never a user-supplied host).
 *
 * Internal GeoJSON contract (same as TransitStudioController@store):
 *   FeatureCollection { LineString|MultiLineString + Point[nameAr][] }
 *   with [lng, lat] axis order (SRID 4326 for ST_GeomFromGeoJSON).
 */
class TransitKmlImportService
{
    public const MAX_KML_BYTES = 5 * 1024 * 1024;

    public const MAX_VERTICES_PER_ROUTE = 5000;

    public const MAX_FEATURES_PER_ROUTE = 500;

    public const MAX_CANDIDATES = 20;

    /** Points closer than this are considered the same stop (My Maps duplicates stops across folders). */
    public const DEDUPE_METERS = 15;

    /**
     * Extract the My Maps `mid` from a share URL or return the bare mid itself.
     */
    public function extractMid(string $input): ?string
    {
        $input = trim($input);
        if ($input === '') {
            return null;
        }

        // Bare mid pasted directly (no URL wrapper).
        if ($this->isValidMid($input)) {
            return $input;
        }

        if (preg_match('/[?&]mid=([A-Za-z0-9_-]+)/', $input, $m)) {
            return $this->isValidMid($m[1]) ? $m[1] : null;
        }

        return null;
    }

    public function isValidMid(string $mid): bool
    {
        return (bool) preg_match('/^[A-Za-z0-9_-]{10,120}$/', $mid);
    }

    /**
     * Fetch raw KML for a validated mid. Throws RuntimeException with an
     * Arabic user-facing message on any failure (controller maps to 422).
     */
    public function fetchKmlByMid(string $mid): string
    {
        if (! $this->isValidMid($mid)) {
            throw new \RuntimeException('رابط خرائط غير صالح — انسخ رابط My Maps الذي يحتوي mid=');
        }

        try {
            $response = Http::withHeaders(['User-Agent' => 'Mozilla/5.0'])
                ->timeout(15)
                ->retry(1, 500)
                ->get('https://www.google.com/maps/d/kml', [
                    'mid' => $mid,
                    'forcekml' => 1,
                ]);
        } catch (\Throwable) {
            throw new \RuntimeException('تعذّر الوصول إلى Google — تحقق من الاتصال وحاول مجدداً');
        }

        $body = (string) $response->body();

        if (! $response->successful() || $body === '' || strlen($body) > self::MAX_KML_BYTES) {
            throw new \RuntimeException('تعذّر جلب الخريطة — تأكد أن الرابط صحيح وأن المشاركة عامة (Anyone with link)');
        }

        $trimmed = ltrim($body);
        if (! str_starts_with($trimmed, '<') || stripos($body, '<html') !== false && stripos($body, '<kml') === false) {
            throw new \RuntimeException('الخريطة غير عامة — فعل المشاركة: Share ثم Anyone with link ثم انسخ الرابط مجدداً');
        }

        return $body;
    }

    /**
     * Parse raw KML into 1..N route candidates.
     *
     * @return array<int, array{name_ar:string, name_en:null, price:?int, notes:?string, geojson:array, vertex_count:int, stop_count:int, bounds:?array, warnings:string[], source:array}>
     */
    public function parseKml(string $kml): array
    {
        if (strlen($kml) > self::MAX_KML_BYTES) {
            throw new \RuntimeException('ملف الخريطة كبير جداً (الحد 5MB)');
        }

        libxml_use_internal_errors(true);
        // LIBXML_NONET blocks XXE/network entity fetches; entity expansion
        // itself is bounded by the size cap above.
        $xml = simplexml_load_string($kml, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        if ($xml === false) {
            libxml_clear_errors();
            throw new \RuntimeException('تعذّر قراءة ملف KML — تأكد أن الرابط يعيد خريطة My Maps صالحة');
        }
        $xml->registerXPathNamespace('k', 'http://www.opengis.net/kml/2.2');

        $docName = trim((string) ($xml->xpath('//k:Document/k:name')[0] ?? ''));
        $docDesc = trim((string) ($xml->xpath('//k:Document/k:description')[0] ?? ''));

        $placemarks = $xml->xpath('//k:Placemark') ?: [];
        if ($placemarks === []) {
            throw new \RuntimeException('لا توجد مسارات في هذه الخريطة — أضف خطاً (Line) ونقاط (Places) في My Maps أولاً');
        }

        $lines = [];
        $points = [];
        $ignored = 0;

        foreach ($placemarks as $pm) {
            /** @var \SimpleXMLElement $pm */
            $pm->registerXPathNamespace('k', 'http://www.opengis.net/kml/2.2');
            $name = trim((string) ($pm->xpath('k:name')[0] ?? ''));

            foreach ($pm->xpath('.//k:LineString/k:coordinates') ?: [] as $coordNode) {
                $coords = $this->parseKmlCoordinates((string) $coordNode);
                if (count($coords) >= 2) {
                    $lines[] = ['name' => $name, 'coordinates' => $coords];
                } else {
                    $ignored++;
                }
            }

            foreach ($pm->xpath('.//k:Point/k:coordinates') ?: [] as $coordNode) {
                $coord = $this->parseSingleKmlTuple((string) $coordNode);
                if ($coord !== null) {
                    $points[] = ['name' => $name, 'coordinates' => $coord];
                } else {
                    $ignored++;
                }
            }

            $hasLine = count($pm->xpath('.//k:LineString') ?: []) > 0;
            $hasPoint = count($pm->xpath('.//k:Point') ?: []) > 0;
            if (! $hasLine && ! $hasPoint) {
                $ignored++;
            }
        }

        libxml_clear_errors();

        return $this->buildCandidates($lines, $points, $docName, $docDesc, $ignored);
    }

    /**
     * Parse an uploaded file (kml / kmz / geojson) into candidates.
     */
    public function parseUploadedFile(UploadedFile $file): array
    {
        if (($file->getSize() ?? 0) > self::MAX_KML_BYTES) {
            throw new \RuntimeException('حجم الملف كبير جداً (الحد 5MB)');
        }

        $ext = strtolower($file->getClientOriginalExtension() ?: '');
        if ($ext === '') {
            $ext = strtolower(pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION));
        }

        if ($ext === 'kmz') {
            return $this->parseKml($this->extractKmlFromKmz($file->getRealPath()));
        }

        if (in_array($ext, ['geojson', 'json'], true)) {
            $decoded = json_decode(file_get_contents($file->getRealPath()), true);
            if (! is_array($decoded)) {
                throw new \RuntimeException('ملف GeoJSON غير صالح');
            }

            return $this->parseGeoJsonDocument($decoded, $file->getClientOriginalName());
        }

        // Default: treat as KML (covers .kml, .xml, .txt exports).
        $contents = file_get_contents($file->getRealPath());
        if ($contents === false || trim($contents) === '') {
            throw new \RuntimeException('الملف فارغ أو تعذّرت قراءته');
        }

        return $this->parseKml($contents);
    }

    /**
     * Normalize an already-GeoJSON document (manual export fallback) into candidates.
     */
    public function parseGeoJsonDocument(array $doc, string $sourceName = ''): array
    {
        $features = $doc['features'] ?? ($doc['type'] === 'Feature' ? [$doc] : []);
        if (! is_array($features) || $features === []) {
            throw new \RuntimeException('ملف GeoJSON لا يحتوي أي معالم (features)');
        }

        $lines = [];
        $points = [];
        $ignored = 0;

        foreach ($features as $f) {
            $geom = is_array($f) ? ($f['geometry'] ?? null) : null;
            $props = is_array($f) ? ($f['properties'] ?? []) : [];
            $type = is_array($geom) ? ($geom['type'] ?? null) : null;
            $coords = is_array($geom) ? ($geom['coordinates'] ?? null) : null;

            if ($type === 'LineString' && is_array($coords)) {
                $clean = $this->cleanLngLatList($coords);
                if (count($clean) >= 2) {
                    $lines[] = ['name' => (string) ($props['nameAr'] ?? $props['name'] ?? ''), 'coordinates' => $clean];

                    continue;
                }
            }

            if ($type === 'MultiLineString' && is_array($coords)) {
                foreach ($coords as $part) {
                    $clean = is_array($part) ? $this->cleanLngLatList($part) : [];
                    if (count($clean) >= 2) {
                        $lines[] = ['name' => (string) ($props['nameAr'] ?? $props['name'] ?? ''), 'coordinates' => $clean];
                    }
                }

                continue;
            }

            if ($type === 'Point' && is_array($coords)) {
                $clean = $this->cleanLngLat($coords);
                if ($clean !== null) {
                    $points[] = ['name' => (string) ($props['nameAr'] ?? $props['name'] ?? ''), 'coordinates' => $clean];

                    continue;
                }
            }

            $ignored++;
        }

        $fallbackName = $sourceName !== '' ? pathinfo($sourceName, PATHINFO_FILENAME) : '';

        return $this->buildCandidates($lines, $points, $fallbackName, '', $ignored);
    }

    // ─── Candidate assembly ──────────────────────────────────────────────

    /**
     * @param  array<int, array{name:string, coordinates:array}>  $lines
     * @param  array<int, array{name:string, coordinates:array}>  $points
     */
    private function buildCandidates(array $lines, array $points, string $docName, string $docDesc, int $ignored): array
    {
        $points = $this->dedupePoints($points, $mergedCount);

        // No drawn line but ≥2 stops: connect stops in document order so the
        // admin still gets a preview (flagged via warning for verification).
        $connectedFallback = false;
        if ($lines === [] && count($points) >= 2) {
            $lines[] = ['name' => '', 'coordinates' => array_map(fn ($p) => $p['coordinates'], $points)];
            $connectedFallback = true;
        }

        if ($lines === []) {
            throw new \RuntimeException('لا يوجد خط مرسوم في هذه الخريطة — ارسم خطاً (Draw line) في My Maps ثم أعد الاستيراد');
        }

        if (count($lines) > self::MAX_CANDIDATES) {
            throw new \RuntimeException('هذه الخريطة تحتوي خطوطاً كثيرة جداً — صدّر كل خط على حدة (الحد 20 خطاً)');
        }

        $price = $this->parsePrice($docDesc);
        $isMulti = count($lines) > 1;
        // Multi-line maps: each stop belongs to exactly one candidate (nearest
        // line by vertex distance). Single-line maps keep every stop.
        $pointOwner = $isMulti ? $this->assignPointsToLines($points, $lines) : array_fill(0, count($points), 0);
        $candidates = [];

        foreach ($lines as $i => $line) {
            $coords = $line['coordinates'];
            if (count($coords) > self::MAX_VERTICES_PER_ROUTE) {
                $coords = $this->thinCoordinates($coords, self::MAX_VERTICES_PER_ROUTE);
                $thinned = true;
            } else {
                $thinned = false;
            }

            $assigned = [];
            foreach ($points as $pi => $p) {
                if (($pointOwner[$pi] ?? 0) === $i) {
                    $assigned[] = $p;
                }
            }

            $features = [
                [
                    'type' => 'Feature',
                    'properties' => new \stdClass,
                    'geometry' => ['type' => 'LineString', 'coordinates' => $coords],
                ],
            ];
            foreach ($assigned as $p) {
                $features[] = [
                    'type' => 'Feature',
                    'properties' => ['nameAr' => $p['name']],
                    'geometry' => ['type' => 'Point', 'coordinates' => $p['coordinates']],
                ];
            }

            if (count($features) > self::MAX_FEATURES_PER_ROUTE) {
                throw new \RuntimeException('عدد المحطات كبير جداً في أحد الخطوط (الحد 500 معلم)');
            }

            // Route name: doc name for single-route maps, line placemark name
            // for multi-route maps (each directions folder names its own trip).
            $routeName = $docName;
            if (count($lines) > 1 && trim($line['name']) !== '' && ! str_starts_with($line['name'], 'الاتجاهات من')) {
                $routeName = trim($line['name']);
            }
            if ($routeName === '') {
                $routeName = count($lines) > 1 ? ('خط مستورد '.($i + 1)) : 'خط مستورد من Google My Maps';
            }

            $warnings = [];
            if ($mergedCount > 0 && $i === 0) {
                $warnings[] = "تم دمج {$mergedCount} نقطة مكررة (نفس الموقع)";
            }
            if ($connectedFallback) {
                $warnings[] = 'لا يوجد خط مرسوم — تم وصل المحطات بترتيبها، تحقق من المسار قبل النشر';
            }
            if ($thinned) {
                $warnings[] = 'تم تخفيف كثافة النقاط لتتجاوز حد 5000 نقطة — راجع الشكل قبل النشر';
            }
            if ($ignored > 0 && $i === 0) {
                $warnings[] = "تم تجاهل {$ignored} معلم غير مدعوم (Polygon/GroundOverlay...)";
            }
            if (count($lines) > 1) {
                $warnings[] = 'خريطة متعددة الخطوط — راجع وانشر كل خط على حدة ('.($i + 1).'/'.count($lines).')';
            }

            $candidates[] = [
                'name_ar' => $routeName,
                'name_en' => null,
                'price' => $price,
                'notes' => $docDesc !== '' ? $docDesc : null,
                'geojson' => ['type' => 'FeatureCollection', 'features' => $features],
                'vertex_count' => count($coords),
                'stop_count' => count($assigned),
                'bounds' => $this->boundsOf($coords, array_map(fn ($p) => $p['coordinates'], $assigned)),
                'warnings' => $warnings,
                'source' => ['doc_name' => $docName, 'doc_description' => $docDesc !== '' ? $docDesc : null],
            ];
        }

        return $candidates;
    }

    // ─── KML primitives ──────────────────────────────────────────────────

    /**
     * @return array<int, array{0:float, 1:float}>
     */
    private function parseKmlCoordinates(string $raw): array
    {
        $out = [];
        foreach (preg_split('/\s+/', trim($raw)) ?: [] as $tuple) {
            $c = $this->parseSingleKmlTuple($tuple);
            if ($c !== null) {
                $out[] = $c;
            }
        }

        return $out;
    }

    /** @return ?array{0:float, 1:float} */
    private function parseSingleKmlTuple(string $tuple): ?array
    {
        $parts = explode(',', trim($tuple));
        if (count($parts) < 2) {
            return null;
        }

        return $this->cleanLngLat([(float) $parts[0], (float) $parts[1]]);
    }

    /** @return ?array{0:float, 1:float} */
    private function cleanLngLat(mixed $pair): ?array
    {
        if (! is_array($pair) || count($pair) < 2 || ! is_numeric($pair[0]) || ! is_numeric($pair[1])) {
            return null;
        }
        $lng = (float) $pair[0];
        $lat = (float) $pair[1];
        if ($lng < -180 || $lng > 180 || $lat < -90 || $lat > 90 || ($lng === 0.0 && $lat === 0.0)) {
            return null;
        }

        return [$lng, $lat];
    }

    /** @return array<int, array{0:float, 1:float}> */
    private function cleanLngLatList(array $list): array
    {
        $out = [];
        foreach ($list as $pair) {
            $c = $this->cleanLngLat($pair);
            if ($c !== null) {
                $out[] = $c;
            }
        }

        return $out;
    }

    private function extractKmlFromKmz(string $path): string
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new \RuntimeException('تعذّر فتح ملف KMZ');
        }

        try {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (is_string($name) && str_ends_with(strtolower($name), '.kml')) {
                    $contents = $zip->getFromIndex($i);
                    if (is_string($contents) && $contents !== '') {
                        return $contents;
                    }
                }
            }
        } finally {
            $zip->close();
        }

        throw new \RuntimeException('ملف KMZ لا يحتوي doc.kml صالحاً');
    }

    // ─── Points: dedupe + assignment ─────────────────────────────────────

    /**
     * @param  array<int, array{name:string, coordinates:array}>  $points
     * @return array<int, array{name:string, coordinates:array}>
     */
    private function dedupePoints(array $points, ?int &$merged = 0): array
    {
        $out = [];
        $merged = 0;
        foreach ($points as $p) {
            $dup = false;
            foreach ($out as $q) {
                if ($this->haversineM($p['coordinates'], $q['coordinates']) <= self::DEDUPE_METERS) {
                    $dup = true;
                    $merged++;
                    // Keep the first non-empty name.
                    break;
                }
            }
            if (! $dup) {
                // Prefer named points: an unnamed duplicate arriving first must
                // not shadow a later named one at the same spot.
                $out[] = $p;
            }
        }

        // If an unnamed point precedes a named duplicate, the loop above kept
        // the unnamed one; fix by back-filling names from dropped duplicates.
        // (Cheap pass: re-scan originals for a better name per kept point.)
        foreach ($out as &$kept) {
            if (trim($kept['name']) !== '') {
                continue;
            }
            foreach ($points as $orig) {
                if (trim($orig['name']) !== '' && $this->haversineM($kept['coordinates'], $orig['coordinates']) <= self::DEDUPE_METERS) {
                    $kept['name'] = $orig['name'];
                    break;
                }
            }
        }

        return array_values($out);
    }

    /**
     * Assign each point to its nearest line (min haversine distance to any
     * vertex). Returns owner line index per point index.
     *
     * @param  array<int, array{name:string, coordinates:array}>  $points
     * @param  array<int, array{name:string, coordinates:array}>  $lines
     * @return array<int, int>
     */
    private function assignPointsToLines(array $points, array $lines): array
    {
        $owners = [];
        foreach ($points as $pi => $p) {
            $best = 0;
            $bestDist = INF;
            foreach ($lines as $li => $line) {
                foreach ($line['coordinates'] as $v) {
                    $d = $this->haversineM($p['coordinates'], $v);
                    if ($d < $bestDist) {
                        $bestDist = $d;
                        $best = $li;
                    }
                }
            }
            $owners[$pi] = $best;
        }

        return $owners;
    }

    private function haversineM(array $a, array $b): float
    {
        [$lng1, $lat1] = $a;
        [$lng2, $lat2] = $b;
        $r = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $h = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * $r * asin(min(1, sqrt($h)));
    }

    /** @return ?array{0:float, 1:float, 2:float, 3:float} [minLng,minLat,maxLng,maxLat] */
    private function boundsOf(array $line, array $stops): ?array
    {
        $all = array_merge($line, $stops);
        if ($all === []) {
            return null;
        }
        $lngs = array_map(fn ($c) => $c[0], $all);
        $lats = array_map(fn ($c) => $c[1], $all);

        return [min($lngs), min($lats), max($lngs), max($lats)];
    }

    /** Evenly thin a dense LineString to $max vertices (keeps endpoints). */
    private function thinCoordinates(array $coords, int $max): array
    {
        $n = count($coords);
        if ($n <= $max) {
            return $coords;
        }
        $out = [];
        for ($i = 0; $i < $max; $i++) {
            $out[] = $coords[(int) floor($i * ($n - 1) / ($max - 1))];
        }

        return $out;
    }

    // ─── Metadata helpers ────────────────────────────────────────────────

    public static function normalizeArabicDigits(string $s): string
    {
        $map = ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9'];

        return strtr($s, $map);
    }

    public function parsePrice(?string $text): ?int
    {
        if ($text === null || trim($text) === '') {
            return null;
        }
        $normalized = self::normalizeArabicDigits($text);
        if (! preg_match('/(\d[\d\s,]*)/u', $normalized, $m)) {
            return null;
        }
        $price = (int) str_replace([',', ' ', '٬'], '', $m[1]);

        return $price >= 0 && $price <= 1000000 ? $price : null;
    }
}
