<?php

namespace App\Support;

use RuntimeException;

/**
 * The one reader for the shared facts in `resources/data/*.json`.
 *
 * Every fact about the domain that both PHP and TypeScript need (the
 * governorate table, the Syria box, place categories, promise states, …) lives
 * in exactly one JSON file there. This class is the PHP side of that contract;
 * `resources/js/Domain/**` is the TypeScript side. Do not restate a value from
 * these files anywhere else.
 *
 * Files are read once per process and memoised. A missing or malformed file is
 * a deploy error, not a runtime condition, so it throws instead of returning an
 * empty list that would silently empty every table built from it.
 */
final class Facts
{
    /** @var array<string, array<mixed>> */
    private static array $files = [];

    /** @var array<string, array<string, mixed>>|null */
    private static ?array $governoratesById = null;

    /** @var array<string, string>|null */
    private static ?array $governorateIdByAlias = null;

    /**
     * @return array<int, array{
     *     id: string, name_ar: string, name_en: string, dataset_name_en: string,
     *     pcode: string, lat: float, lng: float, option_order: int,
     *     picker_order: int, sort_order: int, f3alia_province: string,
     *     transit_svg: string, aliases: array<int, string>
     * }>
     */
    public static function governorates(): array
    {
        /** @var array<int, array{id: string, name_ar: string, name_en: string, dataset_name_en: string, pcode: string, lat: float, lng: float, option_order: int, picker_order: int, sort_order: int, f3alia_province: string, transit_svg: string, aliases: array<int, string>}> $rows */
        $rows = self::json('governorates');

        return $rows;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function governorate(string $id): ?array
    {
        if (self::$governoratesById === null) {
            self::$governoratesById = [];
            foreach (self::governorates() as $row) {
                self::$governoratesById[$row['id']] = $row;
            }
        }

        return self::$governoratesById[$id] ?? null;
    }

    /**
     * Resolve any spelling of a governorate (id, pcode, an English or Arabic
     * variant) to its record. Comparison is normalised, so hamza/ta-marbuta and
     * Latin diacritic variants match the same entry.
     *
     * @return array<string, mixed>|null
     */
    public static function governorateByAnyName(string $name): ?array
    {
        if (self::$governorateIdByAlias === null) {
            self::$governorateIdByAlias = [];
            foreach (self::governorates() as $row) {
                $spellings = [$row['id'], $row['name_ar'], $row['name_en'], $row['dataset_name_en'], $row['pcode'], ...$row['aliases']];
                foreach ($spellings as $spelling) {
                    self::$governorateIdByAlias[self::normalizeName($spelling)] ??= $row['id'];
                }
            }
        }

        $id = self::$governorateIdByAlias[self::normalizeName($name)] ?? null;

        return $id === null ? null : self::governorate($id);
    }

    /**
     * Fold a governorate spelling to its comparison key. Mirrors
     * `normalizeGovernorateName()` in `Domain/geography/governorates.ts`: both
     * sides must agree or a name matches on one side of the wire only.
     */
    public static function normalizeName(string $name): string
    {
        $folded = mb_strtolower(trim($name));
        if ($folded === '') {
            return '';
        }

        // Arabic diacritics and tatweel carry no identity here.
        $folded = (string) preg_replace('/[\x{064B}-\x{0652}\x{0670}\x{0640}]/u', '', $folded);
        // Same letter, typed with a different hamza/ta-marbuta/alef-maqsura.
        $folded = str_replace(
            ['أ', 'إ', 'آ', 'ٱ', 'ة', 'ى'],
            ['ا', 'ا', 'ا', 'ا', 'ه', 'ي'],
            $folded,
        );
        // Latin transliteration: the apostrophe and the dash are separators.
        $folded = str_replace(["'", '`', '’', '‘'], '', $folded);
        $folded = (string) preg_replace('/[\-‐‑‒–—―]/u', ' ', $folded);
        $folded = str_replace(
            ['ḥ', 'ẖ', 'ḫ', 'ḩ', 'ş', 'ṣ', 'ţ', 'ṭ', 'ā', 'ū', 'ī'],
            ['h', 'h', 'h', 'h', 's', 's', 't', 't', 'a', 'u', 'i'],
            $folded,
        );

        return (string) preg_replace('/\s+/u', ' ', $folded);
    }

    /**
     * @return array{bbox: array{lat_min: float, lat_max: float, lng_min: float, lng_max: float}, country_code: string, timezone: string}
     */
    public static function syria(): array
    {
        /** @var array{bbox: array{lat_min: float, lat_max: float, lng_min: float, lng_max: float}, country_code: string, timezone: string} $syria */
        $syria = self::json('syria');

        return $syria;
    }

    /**
     * The Syrian box as [minLng, minLat, maxLng, maxLat], the order every
     * bounding-box query and map call expects.
     *
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    public static function syriaBox(): array
    {
        $box = self::syria()['bbox'];

        return [(float) $box['lng_min'], (float) $box['lat_min'], (float) $box['lng_max'], (float) $box['lat_max']];
    }

    /**
     * @return array{categories: array<int, array{key: string, label: string, glyph: string}>, statuses: array<int, string>, nearby: array{radius_km_default: float, radius_km_min: float, radius_km_max: float}}
     */
    public static function places(): array
    {
        /** @var array{categories: array<int, array{key: string, label: string, glyph: string}>, statuses: array<int, string>, nearby: array{radius_km_default: float, radius_km_min: float, radius_km_max: float}} $places */
        $places = self::json('places');

        return $places;
    }

    /**
     * @return array<int, string>
     */
    public static function placeCategories(): array
    {
        return array_column(self::places()['categories'], 'key');
    }

    /**
     * Category key => [Arabic label, card glyph].
     *
     * @return array<string, array{0: string, 1: string}>
     */
    public static function placeCategoryCards(): array
    {
        $out = [];
        foreach (self::places()['categories'] as $category) {
            $out[$category['key']] = [$category['label'], $category['glyph']];
        }

        return $out;
    }

    /**
     * @return array<int, string>
     */
    public static function placeStatuses(): array
    {
        return self::places()['statuses'];
    }

    /**
     * @return array<int, string>
     */
    public static function promiseStatuses(): array
    {
        return self::json('promises')['statuses'];
    }

    /**
     * Display state => [label, card tone, glyph]. `overdue` is derived from an
     * open promise's deadline rather than stored, so it is a state, not a status.
     *
     * @return array<string, array{0: string, 1: string, 2: string}>
     */
    public static function promiseStates(): array
    {
        $out = [];
        foreach (self::json('promises')['states'] as $state) {
            $out[$state['key']] = [$state['label'], $state['card_tone'], $state['glyph']];
        }

        return $out;
    }

    /**
     * @return array{core_slug: string, default_timezone: string, min_selections: int}
     */
    public static function polls(): array
    {
        /** @var array{core_slug: string, default_timezone: string, min_selections: int} $polls */
        $polls = self::json('polls');

        return $polls;
    }

    /**
     * @return array{color_index_max: int, nearby_stops_radius_m: int, nearby_stops_radius_max_m: int}
     */
    public static function transit(): array
    {
        /** @var array{color_index_max: int, nearby_stops_radius_m: int, nearby_stops_radius_max_m: int, route_palette: array<int, string>} $transit */
        $transit = self::json('transit');

        return $transit;
    }

    /**
     * @return array<int, array{slug: string, title: string, href?: string, online?: bool, external?: bool, comingSoon?: bool}>
     */
    public static function games(): array
    {
        /** @var array<int, array{slug: string, title: string, href?: string, online?: bool, external?: bool, comingSoon?: bool}> $games */
        $games = self::json('games');

        return $games;
    }

    /**
     * The prayer-calculation method table: the default method, the methods the
     * picker offers in display order, and the extra method ids the prayer proxy
     * accepts although the UI does not offer them (a stored account setting
     * must survive a round trip even when its method is not on the list).
     *
     * @return array{default_method: int, methods: array<int, array{id: int, name_ar: string, name_en: string, detail: string}>, unlisted_method_ids: array<int, int>}
     */
    public static function prayer(): array
    {
        /** @var array{default_method: int, methods: array<int, array{id: int, name_ar: string, name_en: string, detail: string}>, unlisted_method_ids: array<int, int>} $prayer */
        $prayer = self::json('prayer');

        return $prayer;
    }

    /**
     * The governorate outline drawings, keyed by the SVG basename that
     * `governorates.json` carries as `transit_svg`: the `viewBox` plus the path
     * `d` the transit API, the landing grid and the mobile client draw.
     *
     * The SVG files under `resources/js/Pages/Transit/_data/governorates/` stay
     * the authoring source because the browser loads them directly with
     * `import.meta.glob`; this file is the server-readable copy, and
     * tests/Feature/GovernorateIconFactsTest.php fails when the two drift.
     *
     * @return array<string, array{viewBox: string, path: string}>
     */
    public static function governorateIcons(): array
    {
        /** @var array<string, array{viewBox: string, path: string}> $icons */
        $icons = self::json('governorate-icons');

        return $icons;
    }

    /**
     * One governorate outline by SVG basename, or null when none is drawn.
     *
     * @return array{viewBox: string, path: string}|null
     */
    public static function governorateIcon(string $file): ?array
    {
        return self::governorateIcons()[$file] ?? null;
    }

    /**
     * @return array{base_url: string}
     */
    public static function site(): array
    {
        /** @var array{base_url: string} $site */
        $site = self::json('site');

        return $site;
    }

    /**
     * The site-module catalogue: every navigation entry the site ships with,
     * the search copy for each one, and the admin cards the dashboard offers.
     * The stored `site_navigation` row overrides the navigation half; the rest
     * is read from here directly on both sides of the wire.
     *
     * @return array{
     *     navbar: array{topCount: int},
     *     modules: array<int, array<string, mixed>>,
     *     adminSections: array<int, array<string, mixed>>
     * }
     */
    public static function siteModules(): array
    {
        /** @var array{navbar: array{topCount: int}, modules: array<int, array<string, mixed>>, adminSections: array<int, array<string, mixed>>} $modules */
        $modules = self::json('site-modules');

        return $modules;
    }

    /**
     * The one drawing per icon key, rendered by `Components/Icons/ProjectIcons`
     * in React and by `<x-project-icon>` in Blade. A key is either an `alias`
     * of another key or a `viewBox` + `body` of SVG markup.
     *
     * @return array{icons: array<string, array<string, mixed>>}
     */
    public static function projectIcons(): array
    {
        /** @var array{icons: array<string, array<string, mixed>>} $icons */
        $icons = self::json('project-icons');

        return $icons;
    }

    /**
     * The public base URL of the media store (Cloudflare R2). A stored file
     * name is served from here; `R2_PUBLIC_URL` / `R2_URL` still override it in
     * a deployment, but the default lives in one file for both languages.
     *
     * @return array{public_base: string}
     */
    public static function media(): array
    {
        /** @var array{public_base: string} $media */
        $media = self::json('media');

        return $media;
    }

    /**
     * The theme record: storage keys, the system-preference id, the font
     * defaults and every theme's identity. Read by the pre-paint script in
     * `resources/views/app.blade.php` and by `Lib/theme.ts`; both sides render
     * from this one file.
     *
     * @return array<string, mixed>
     */
    public static function themes(): array
    {
        return self::json('themes');
    }

    /**
     * @return array{enabled: bool, title: string, description: string, buttonText: string, dismissText: string, link: string, version: int}
     */
    public static function sitePopup(): array
    {
        /** @var array{enabled: bool, title: string, description: string, buttonText: string, dismissText: string, link: string, version: int} $popup */
        $popup = self::json('site-popup');

        return $popup;
    }

    /**
     * One shared facts file, decoded and memoised for the request.
     *
     * Public because every reader of `resources/data` must share this one cache
     * and this one failure mode: a missing or malformed file is a deploy error,
     * so it throws instead of returning a partial value.
     *
     * @return array<mixed>
     */
    public static function json(string $name): array
    {
        if (isset(self::$files[$name])) {
            return self::$files[$name];
        }

        $path = resource_path("data/{$name}.json");
        $json = @file_get_contents($path);
        if ($json === false) {
            throw new RuntimeException("Missing shared facts file: {$path}");
        }

        $decoded = json_decode($json, true);
        if (! is_array($decoded)) {
            throw new RuntimeException("Malformed shared facts file: {$path}");
        }

        return self::$files[$name] = $decoded;
    }
}
