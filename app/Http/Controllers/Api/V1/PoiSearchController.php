<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\City;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * POI search for the transit map ("where is the nearest mosque/cafe?").
 *
 * The CARTO vector tiles the map renders are draw-only — they expose no
 * search API — so this proxies geocoders built on the same underlying
 * OpenStreetMap data instead. The browser never calls a third-party host
 * directly (same rule as weather/events/prayer), and going through the app
 * gets us caching, throttling, and a stable payload.
 *
 * Strategy: Photon (free, keyless OSM geocoder) first; Google Places only as
 * a fallback when Photon returns fewer than MIN_PHOTON_RESULTS, so paid
 * quota burns solely on misses. Either upstream failing yields an empty
 * list (never a 500), and transport failures are never cached.
 */
class PoiSearchController extends Controller
{
    private const MIN_PHOTON_RESULTS = 3;

    private const LIMIT = 8;

    private const CACHE_TTL = 86400;

    // Whole-Syria fallback box (same box the Mishwar submit form enforces).
    private const SYRIA_BOX = [35.5, 32.0, 42.5, 37.5]; // minLng, minLat, maxLng, maxLat

    // Place-type synonym groups (Photon matches tokens literally, so without
    // expansion "جامع السلام" never finds a node named "مسجد السلام").
    // Expansion is Photon-only: Google's semantic matching already handles
    // synonyms, so expanding there would just burn quota.
    private const SYNONYM_GROUPS = [
        ['مسجد', 'جامع', 'مصلى', 'مصلي'],
        ['مقهى', 'كافيه', 'قهوة'],
        ['مطعم', 'مطاعم'],
        ['حديقة', 'منتزه', 'جنينة'],
        ['مستشفى', 'مشفى'],
        ['مدرسة', 'مدارس'],
        ['صيدلية', 'صيدليات'],
        ['مخبز', 'مخابز', 'فرن'],
    ];

    private const MAX_VARIANTS = 4; // original + up to 3 synonym swaps

    // OSM amenity/shop values worth an Arabic label; everything else falls
    // back to the raw value. Note amenity=place_of_worship carries no
    // religion in Photon responses, so it stays a generic "house of worship".
    private const OSM_LABELS = [
        'place_of_worship' => 'دار عبادة',
        'cafe' => 'مقهى',
        'restaurant' => 'مطعم',
        'fast_food' => 'وجبات سريعة',
        'bakery' => 'مخبز',
        'school' => 'مدرسة',
        'university' => 'جامعة',
        'hospital' => 'مستشفى',
        'pharmacy' => 'صيدلية',
        'bank' => 'مصرف',
        'fuel' => 'محطة وقود',
        'hotel' => 'فندق',
        'market' => 'سوق',
        'mall' => 'مركز تسوق',
        'park' => 'حديقة',
        'museum' => 'متحف',
        'library' => 'مكتبة',
        'cinema' => 'سينما',
    ];

    // Google place types worth an Arabic label (Google does distinguish
    // mosques, which is exactly why it is the fallback).
    private const GOOGLE_LABELS = [
        'mosque' => 'مسجد',
        'church' => 'كنيسة',
        'cafe' => 'مقهى',
        'restaurant' => 'مطعم',
        'school' => 'مدرسة',
        'hospital' => 'مستشفى',
        'pharmacy' => 'صيدلية',
        'bank' => 'مصرف',
        'gas_station' => 'محطة وقود',
        'lodging' => 'فندق',
        'park' => 'حديقة',
        'museum' => 'متحف',
        'library' => 'مكتبة',
        'movie_theater' => 'سينما',
        'bakery' => 'مخبز',
    ];

    public function search(Request $request)
    {
        $validated = $request->validate([
            'q' => 'required|string|min:3|max:100',
            'city_id' => 'sometimes|string|exists:cities,id',
        ]);

        $box = $this->bboxForCity($validated['city_id'] ?? null);
        // Light normalization (diacritics/tatweel only — real spellings stay
        // intact for the upstream). Expansion below is deterministic, so the
        // key covers all variants of the same query.
        $q = self::normalizeQuery($validated['q']);
        $cacheKey = 'poi:search:' . md5($q . '|' . implode(',', $box));

        $places = Cache::get($cacheKey);
        if ($places === null) {
            $places = $this->fromPhoton($q, $box);

            if (count($places) < self::MIN_PHOTON_RESULTS) {
                $places = $this->mergeGoogleFallback($places, $validated['q'], $box);
            }

            Cache::put($cacheKey, $places, self::CACHE_TTL);
        }

        return response()->json(['places' => $places])
            ->header('Cache-Control', 'public, max-age=3600');
    }

    /**
     * City bounds as [minLng, minLat, maxLng, maxLat] for biasing. Unknown or
     * unreadable geometry falls back to the Syria box — never a 404, the box
     * is only a soft bias for both upstreams.
     */
    private function bboxForCity(?string $cityId): array
    {
        if ($cityId) {
            try {
                $row = City::select(DB::raw('ST_AsGeoJSON(bounds) as geojson'))
                    ->where('id', $cityId)
                    ->first();
                $geo = $row ? json_decode($row->geojson, true) : null;
                $box = $this->bboxOfGeometry($geo);
                if ($box) {
                    return $box;
                }
            } catch (\Throwable) {
                // fall through to the Syria box
            }
        }

        return self::SYRIA_BOX;
    }

    private function bboxOfGeometry(?array $geo): ?array
    {
        if (! is_array($geo) || ! isset($geo['coordinates']) || ! is_array($geo['coordinates'])) {
            return null;
        }

        $lngs = $lats = [];
        $walk = function ($node) use (&$walk, &$lngs, &$lats) {
            if (is_array($node) && count($node) === 2 && is_numeric($node[0] ?? null) && is_numeric($node[1] ?? null)) {
                $lngs[] = (float) $node[0];
                $lats[] = (float) $node[1];

                return;
            }
            if (is_array($node)) {
                foreach ($node as $child) {
                    $walk($child);
                }
            }
        };
        $walk($geo['coordinates']);

        if ($lngs === []) {
            return null;
        }

        return [min($lngs), min($lats), max($lngs), max($lats)];
    }

    private function fromPhoton(string $q, array $box): array
    {
        // Original query plus synonym swaps, fired in parallel (Photon is
        // free). Original-query hits keep their order first; variant hits
        // append after, so exact matches always outrank expansions.
        $queries = $this->expandPhotonQueries($q);

        try {
            $responses = Http::pool(fn ($pool) => array_map(
                fn ($qq) => $pool->timeout(8)->get('https://photon.komoot.io/api/', [
                    'q' => $qq,
                    'limit' => self::LIMIT,
                    'bbox' => implode(',', $box),
                ]),
                $queries
            ));
        } catch (\Throwable) {
            return [];
        }

        $places = [];
        $seen = [];
        foreach ($responses as $response) {
            if (! $response->successful()) {
                continue;
            }
            foreach ($response->json('features') ?? [] as $f) {
                $place = $this->normalizePhotonFeature($f);
                if ($place === null) {
                    continue;
                }
                // De-dupe across variants: the same node comes back for every
                // spelling at identical coordinates.
                $key = mb_strtolower($place['name']) . '|' . round($place['lat'], 4) . ',' . round($place['lng'], 4);
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $places[] = $place;
                if (count($places) >= self::LIMIT) {
                    break 2;
                }
            }
        }

        return $places;
    }

    private function normalizePhotonFeature(array $f): ?array
    {
        // NOTE: no `lang` parameter on the request — Photon 400s on languages
        // it was not imported with (verified: lang=ar → HTTP 400, always
        // empty). Local names (Arabic for Syrian POIs) come back natively.
        $props = $f['properties'] ?? [];
        $coords = $f['geometry']['coordinates'] ?? null;
        $name = trim((string) ($props['name'] ?? ''));
        if ($name === '' || ! is_array($coords) || count($coords) < 2) {
            return null;
        }

        $osmValue = (string) ($props['osm_value'] ?? '');

        return [
            'name' => $name,
            'category' => self::OSM_LABELS[$osmValue] ?? ($osmValue !== '' ? $osmValue : 'مكان'),
            'lat' => (float) $coords[1],
            'lng' => (float) $coords[0],
            'district' => $props['district'] ?? $props['suburb'] ?? $props['borough'] ?? null,
            'city' => $props['city'] ?? $props['town'] ?? $props['village'] ?? $props['county'] ?? $props['state'] ?? null,
            'source' => 'osm',
        ];
    }

    /**
     * Light Arabic normalization for matching + cache keys: strip diacritics
     * and tatweel, collapse whitespace. Real spellings (alef forms, ة, ى)
     * are left intact so upstream matching is unaffected.
     */
    public static function normalizeQuery(string $s): string
    {
        $s = mb_strtolower(trim($s));
        $s = (string) preg_replace('/[\x{064B}-\x{0652}\x{0670}\x{0640}]/u', '', $s);
        $s = (string) preg_replace('/\s+/u', ' ', $s);

        return trim($s);
    }

    /**
     * If the (normalized) query contains exactly one known place-type word,
     * return the query plus variants with each synonym swapped in
     * (article-aware: "الجامع" expands to "المسجد", not "مسجد"). Anything
     * else — no type word, or several — returns the single query unchanged,
     * bounding upstream fan-out.
     *
     * @return string[]
     */
    public function expandPhotonQueries(string $q): array
    {
        $tokens = preg_split('/\s+/u', $q);
        $hits = [];
        foreach ($tokens as $i => $t) {
            foreach (self::SYNONYM_GROUPS as $g) {
                if (in_array(self::stripArticle($t), $g, true)) {
                    $hits[$i] = $g;
                    break;
                }
            }
        }

        if (count($hits) !== 1) {
            return [$q];
        }

        $i = array_key_first($hits);
        $hadArticle = self::stripArticle($tokens[$i]) !== $tokens[$i];
        $out = [$q];
        foreach ($hits[$i] as $member) {
            $rep = $hadArticle ? 'ال' . $member : $member;
            if ($rep === $tokens[$i]) {
                continue;
            }
            $variant = $tokens;
            $variant[$i] = $rep;
            $out[] = implode(' ', $variant);
            if (count($out) >= self::MAX_VARIANTS) {
                break;
            }
        }

        return $out;
    }

    private static function stripArticle(string $token): string
    {
        if (mb_strlen($token) > 3 && str_starts_with($token, 'ال')) {
            return mb_substr($token, 2);
        }

        return $token;
    }

    /**
     * Top up thin Photon results with Google Places (paid). Skipped entirely
     * when no key is configured. Google rows incl. mosques come first only
     * when Photon found nothing at all; otherwise they append after OSM rows.
     */
    private function mergeGoogleFallback(array $places, string $q, array $box): array
    {
        $key = config('services.google_places.key');
        if (! $key) {
            return $places;
        }

        try {
            $response = Http::timeout(8)
                ->withHeaders([
                    'X-Goog-Api-Key' => $key,
                    'X-Goog-FieldMask' => 'places.displayName,places.formattedAddress,places.location,places.types',
                ])
                ->post('https://places.googleapis.com/v1/places:searchText', [
                    'textQuery' => $q,
                    'languageCode' => 'ar',
                    'regionCode' => 'SY',
                    'locationBias' => ['rectangle' => [
                        'low' => ['latitude' => $box[1], 'longitude' => $box[0]],
                        'high' => ['latitude' => $box[3], 'longitude' => $box[2]],
                    ]],
                    'maxResultCount' => self::LIMIT,
                ]);
        } catch (\Throwable) {
            return $places;
        }

        if (! $response->successful()) {
            return $places;
        }

        $google = collect($response->json('places') ?? [])
            ->map(function ($p) {
                $name = $p['displayName']['text'] ?? '';
                $lat = $p['location']['latitude'] ?? null;
                $lng = $p['location']['longitude'] ?? null;
                if ($name === '' || $lat === null || $lng === null) {
                    return null;
                }

                $label = 'مكان';
                foreach ((array) ($p['types'] ?? []) as $type) {
                    if (isset(self::GOOGLE_LABELS[$type])) {
                        $label = self::GOOGLE_LABELS[$type];
                        break;
                    }
                }

                return [
                    'name' => $name,
                    'category' => $label,
                    'lat' => (float) $lat,
                    'lng' => (float) $lng,
                    'address' => $p['formattedAddress'] ?? null,
                    'source' => 'google',
                ];
            })
            ->filter()
            ->values()
            ->all();

        // De-dupe by rounded coordinates so the same venue from both
        // upstreams does not appear twice.
        $seen = [];
        foreach ($places as $p) {
            $seen[round($p['lat'], 4) . ',' . round($p['lng'], 4)] = true;
        }
        foreach ($google as $g) {
            $k = round($g['lat'], 4) . ',' . round($g['lng'], 4);
            if (! isset($seen[$k])) {
                $seen[$k] = true;
                $places[] = $g;
            }
        }

        return array_slice($places, 0, self::LIMIT);
    }
}
