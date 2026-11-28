<?php

namespace App\Models;

use App\Support\Facts;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SiteSetting extends Model
{
    protected $fillable = ['key', 'value', 'updated_by'];

    protected $casts = ['value' => 'array'];

    public const HOMEPAGE_POPUP_KEY = 'homepage_popup';

    public const SITE_NAVIGATION_KEY = 'site_navigation';

    /** @var array{version?: string, aliases?: array<string, string>, icons?: array<string, array{light?: string, dark?: string}>}|null */
    private static ?array $moduleIconManifest = null;

    /**
     * Resolve an icon key (following aliases such as `atlas` -> `population`,
     * `places` -> `mishwar`, `polls` -> `tierlist`) to its canonical drawing key,
     * or null if the key is unknown.
     */
    public static function resolveIconKey(?string $iconKey): ?string
    {
        if ($iconKey === null || trim($iconKey) === '') {
            return null;
        }

        $icons = Facts::projectIcons()['icons'] ?? [];
        $key = trim($iconKey);

        for ($hop = 0; $hop < 5; $hop++) {
            $entry = $icons[$key] ?? null;
            if (! is_array($entry)) {
                return null;
            }
            if (! isset($entry['alias'])) {
                return isset($entry['body']) ? $key : null;
            }
            $key = trim((string) $entry['alias']);
        }

        return null;
    }

    /**
     * Read the exported module icons manifest (`public/assets/icons/modules/manifest.json`)
     * for cache-busting content hashes.
     *
     * @return array{version?: string, aliases?: array<string, string>, icons?: array<string, array{light?: string, dark?: string}>}
     */
    public static function moduleIconManifest(): array
    {
        if (self::$moduleIconManifest !== null) {
            return self::$moduleIconManifest;
        }

        $path = public_path('assets/icons/modules/manifest.json');
        if (! is_file($path)) {
            return self::$moduleIconManifest = [];
        }

        $decoded = json_decode((string) @file_get_contents($path), true);

        return self::$moduleIconManifest = is_array($decoded) ? $decoded : [];
    }

    /**
     * Build an absolute, cache-busted URL for a compiled module SVG icon.
     */
    public static function moduleIconUrl(string $canonicalKey, bool $dark = false): string
    {
        $manifest = static::moduleIconManifest();
        $variant = $dark ? 'dark' : 'light';
        $hash = $manifest['icons'][$canonicalKey][$variant] ?? ($manifest['version'] ?? null);
        $suffix = $dark ? '-dark' : '';
        $path = "/assets/icons/modules/{$canonicalKey}{$suffix}.svg";
        if (is_string($hash) && $hash !== '') {
            $path .= '?v='.rawurlencode($hash);
        }

        return url($path);
    }

    /**
     * Ensure any relative icon path (e.g. `/assets/games/president.svg` or
     * `/flag-replacer/1f1f8-1f1fe.svg`) is returned as an absolute URL so
     * mobile clients never have to guess the base host.
     */
    public static function normalizeIconUrl(?string $iconUrl): ?string
    {
        if ($iconUrl === null) {
            return null;
        }

        $trimmed = trim($iconUrl);
        if ($trimmed === '') {
            return null;
        }

        if (str_starts_with($trimmed, 'http://') || str_starts_with($trimmed, 'https://')) {
            return $trimmed;
        }

        if (str_starts_with($trimmed, '//')) {
            return 'https:'.$trimmed;
        }

        return url($trimmed);
    }

    private static function isGeneratedModuleIconUrl(?string $url): bool
    {
        return is_string($url) && str_contains($url, '/assets/icons/modules/');
    }

    /**
     * The copy the site ships with. The row in `site_settings` overrides it;
     * the browser falls back to the same file (resources/data/site-popup.json)
     * when the shared prop is absent, so the two can never disagree.
     */
    public static function defaults(): array
    {
        return Facts::sitePopup();
    }

    public static function getPopup(): array
    {
        return Cache::remember('site_popup', 300, function () {
            try {
                $row = static::where('key', static::HOMEPAGE_POPUP_KEY)->first();
                if (! $row || ! is_array($row->value)) {
                    return static::defaults();
                }

                return array_merge(static::defaults(), $row->value);
            } catch (\Throwable) {
                return static::defaults();
            }
        });
    }

    /**
     * Popup and navigation for the shared Inertia props, read with one cache
     * round trip instead of two. Every page pays for this, and on the database
     * cache store each lookup is its own query.
     *
     * @return array{popup: array<string, mixed>, navigation: array<string, mixed>}
     */
    public static function shared(): array
    {
        $cached = Cache::many(['site_popup', 'site_navigation']);

        return [
            'popup' => $cached['site_popup'] ?? static::getPopup(),
            'navigation' => $cached['site_navigation'] ?? static::getNavigation(),
        ];
    }

    public static function flushPopupCache(): void
    {
        Cache::forget('site_popup');
    }

    /**
     * Default canonical list of Syrian Zone navigation items (Homepage grid, Navbar, Mobile Menu, and Flutter app).
     *
     * The list itself is `resources/data/site-modules.json`, the same file the
     * browser reads, so the server defaults and the client's fallback cannot
     * disagree.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function defaultNavigationItems(): array
    {
        $rawItems = Facts::siteModules()['modules'];

        return array_values(array_map(fn (array $item, int $index) => static::normalizeNavigationItem($item, $index, false), $rawItems, array_keys($rawItems)));
    }

    /**
     * Normalize a single navigation catalog item so both the mobile/API schema
     * (`id`, `title`, `subtitle`, `iconUrl`, `type`, `target`, `subCategories`, `surfaces`, `enabled`)
     * and the web frontend schema (`text`, `href`, `iconKey`, `image`, `external`, `isInternal`, `showOnHome`, `showInNavbar`)
     * are always present and synchronized.
     *
     * @param  array<string, mixed>  $raw
     * @param  array<string, mixed>|null  $fallback
     * @return array<string, mixed>
     */
    public static function normalizeNavigationItem(array $raw, int $sortOrder = 0, bool $defaultIsCustom = true, ?array $fallback = null): array
    {
        $base = $fallback ?? [];

        $href = trim((string) ($raw['href'] ?? $base['href'] ?? $raw['target'] ?? '/'));
        $title = trim((string) ($raw['title'] ?? $raw['text'] ?? $base['title'] ?? $base['text'] ?? ''));
        $subtitle = trim((string) ($raw['subtitle'] ?? $base['subtitle'] ?? ''));
        $id = trim((string) ($raw['id'] ?? $base['id'] ?? $href));

        $isExternalHref = str_starts_with($href, 'http://') || str_starts_with($href, 'https://');
        $external = array_key_exists('external', $raw)
            ? (bool) $raw['external']
            : (bool) ($base['external'] ?? $isExternalHref);

        $type = trim((string) ($raw['type'] ?? $base['type'] ?? ($external ? 'external' : 'web')));
        if (! in_array($type, ['native', 'web', 'external'], true)) {
            $type = $external ? 'external' : 'web';
        }

        $target = trim((string) ($raw['target'] ?? $base['target'] ?? $href));
        $iconKey = array_key_exists('iconKey', $raw)
            ? (! empty($raw['iconKey']) ? trim((string) $raw['iconKey']) : null)
            : ($base['iconKey'] ?? null);

        $baseIconUrl = ! empty($base['iconUrl'])
            ? (string) $base['iconUrl']
            : (! empty($base['image']) ? (string) $base['image'] : null);
        $baseIconUrlDark = ! empty($base['iconUrlDark'])
            ? (string) $base['iconUrlDark']
            : (! empty($base['imageDark']) ? (string) $base['imageDark'] : null);
        $iconKeyChanged = ($base['iconKey'] ?? null) !== $iconKey;

        $iconUrl = null;
        if (array_key_exists('iconUrl', $raw) && ! empty($raw['iconUrl'])) {
            $iconUrl = trim((string) $raw['iconUrl']);
        } elseif (array_key_exists('image', $raw) && ! empty($raw['image'])) {
            $iconUrl = trim((string) $raw['image']);
        } elseif ($baseIconUrl !== null && (! $iconKeyChanged || ! static::isGeneratedModuleIconUrl($baseIconUrl))) {
            $iconUrl = $baseIconUrl;
        }

        $iconUrlDark = null;
        if (array_key_exists('iconUrlDark', $raw)) {
            $iconUrlDark = ! empty($raw['iconUrlDark']) ? trim((string) $raw['iconUrlDark']) : null;
        } elseif (array_key_exists('imageDark', $raw)) {
            $iconUrlDark = ! empty($raw['imageDark']) ? trim((string) $raw['imageDark']) : null;
        } elseif ($baseIconUrlDark !== null && (! $iconKeyChanged || ! static::isGeneratedModuleIconUrl($baseIconUrlDark))) {
            $iconUrlDark = $baseIconUrlDark;
        }

        if ($iconUrl === null && $iconKey !== null) {
            $canonicalKey = static::resolveIconKey($iconKey);
            if ($canonicalKey !== null) {
                $iconUrl = static::moduleIconUrl($canonicalKey, false);
                if ($iconUrlDark === null) {
                    $iconUrlDark = static::moduleIconUrl($canonicalKey, true);
                }
            }
        }

        $iconUrl = static::normalizeIconUrl($iconUrl);
        $iconUrlDark = static::normalizeIconUrl($iconUrlDark);

        $validGroupIds = array_column(static::navigationGroups(), 'id');
        $group = null;
        if (array_key_exists('group', $raw) && is_string($raw['group']) && trim($raw['group']) !== '' && in_array(trim($raw['group']), $validGroupIds, true)) {
            $group = trim($raw['group']);
        } elseif (! empty($base['group']) && is_string($base['group'])) {
            $group = trim($base['group']);
        }

        $groupOrder = array_key_exists('groupOrder', $raw) && $raw['groupOrder'] !== null
            ? (int) $raw['groupOrder']
            : (isset($base['groupOrder']) ? (int) $base['groupOrder'] : null);

        $enabled = array_key_exists('enabled', $raw)
            ? (bool) $raw['enabled']
            : (bool) ($base['enabled'] ?? true);

        $showOnHome = array_key_exists('showOnHome', $raw)
            ? (bool) $raw['showOnHome']
            : (bool) ($base['showOnHome'] ?? true);

        $showInNavbar = array_key_exists('showInNavbar', $raw)
            ? (bool) $raw['showInNavbar']
            : (bool) ($base['showInNavbar'] ?? true);

        if (isset($raw['surfaces']) && is_array($raw['surfaces'])) {
            $surfaces = array_values(array_unique(array_filter(array_map('strval', $raw['surfaces']))));
            if (array_key_exists('showOnHome', $raw)) {
                if ($showOnHome && ! in_array('home', $surfaces, true)) {
                    $surfaces[] = 'home';
                } elseif (! $showOnHome) {
                    $surfaces = array_values(array_diff($surfaces, ['home']));
                }
            } else {
                $showOnHome = in_array('home', $surfaces, true);
            }
            if (array_key_exists('showInNavbar', $raw)) {
                if ($showInNavbar && ! in_array('navbar', $surfaces, true)) {
                    $surfaces[] = 'navbar';
                } elseif (! $showInNavbar) {
                    $surfaces = array_values(array_diff($surfaces, ['navbar']));
                }
            } else {
                $showInNavbar = in_array('navbar', $surfaces, true);
            }
        } else {
            $surfaces = [];
            if ($showOnHome) {
                $surfaces[] = 'home';
            }
            if ($showInNavbar) {
                $surfaces[] = 'navbar';
            }
            $surfaces[] = 'mobile_menu';
            $surfaces[] = 'mobile_home';
        }

        if (! $enabled) {
            $showOnHome = false;
            $showInNavbar = false;
        }

        $rawSubCategories = $raw['subCategories'] ?? $base['subCategories'] ?? [];
        $subCategories = [];
        if (is_array($rawSubCategories)) {
            foreach ($rawSubCategories as $subIdx => $sub) {
                if (! is_array($sub)) {
                    continue;
                }
                $subTitle = trim((string) ($sub['title'] ?? $sub['text'] ?? ''));
                $subHref = trim((string) ($sub['href'] ?? $sub['target'] ?? ''));
                if ($subTitle === '' && $subHref === '') {
                    continue;
                }
                $subIconKey = ! empty($sub['iconKey']) ? trim((string) $sub['iconKey']) : $iconKey;
                $subIconUrl = ! empty($sub['iconUrl']) ? static::normalizeIconUrl(trim((string) $sub['iconUrl'])) : null;
                $subIconUrlDark = ! empty($sub['iconUrlDark']) ? static::normalizeIconUrl(trim((string) $sub['iconUrlDark'])) : null;

                if ($subIconUrl === null && $subIconKey !== null) {
                    $canonicalSubKey = static::resolveIconKey($subIconKey);
                    if ($canonicalSubKey !== null) {
                        $subIconUrl = static::moduleIconUrl($canonicalSubKey, false);
                        if ($subIconUrlDark === null) {
                            $subIconUrlDark = static::moduleIconUrl($canonicalSubKey, true);
                        }
                    }
                }

                $subCategories[] = [
                    'id' => trim((string) ($sub['id'] ?? ($id.'_sub_'.$subIdx))),
                    'title' => $subTitle,
                    'subtitle' => trim((string) ($sub['subtitle'] ?? '')),
                    'href' => $subHref !== '' ? $subHref : $href,
                    'type' => in_array(($sub['type'] ?? 'web'), ['native', 'web', 'external'], true) ? (string) $sub['type'] : 'web',
                    'target' => trim((string) ($sub['target'] ?? ($subHref !== '' ? $subHref : $href))),
                    'iconKey' => $subIconKey,
                    'iconUrl' => $subIconUrl,
                    'iconUrlDark' => $subIconUrlDark,
                ];
            }
        }

        return [
            'id' => $id,
            'title' => $title,
            'subtitle' => $subtitle,
            'text' => $title,
            'href' => $href,
            'type' => $type,
            'target' => $target,
            'iconKey' => $iconKey,
            'iconUrl' => $iconUrl,
            'iconUrlDark' => $iconUrlDark,
            'image' => $iconUrl,
            'imageDark' => $iconUrlDark,
            'group' => $group,
            'groupOrder' => $groupOrder,
            'isFlag' => (bool) ($raw['isFlag'] ?? $base['isFlag'] ?? false),
            'external' => $external,
            'isInternal' => (bool) ($raw['isInternal'] ?? $base['isInternal'] ?? ! $external),
            'enabled' => $enabled,
            'showOnHome' => $showOnHome,
            'showInNavbar' => $showInNavbar,
            'surfaces' => array_values($surfaces),
            'subCategories' => $subCategories,
            'sortOrder' => (int) ($raw['sortOrder'] ?? $sortOrder),
            'isCustom' => (bool) ($base['isCustom'] ?? ($raw['isCustom'] ?? $defaultIsCustom)),
        ];
    }

    /**
     * @return array<int, array{id: string, title: string}>
     */
    public static function navigationGroups(): array
    {
        $raw = Facts::siteModules()['groups'] ?? [];
        $groups = [];
        foreach ($raw as $entry) {
            if (! is_array($entry)) {
                continue;
            }
            $id = trim((string) ($entry['id'] ?? ''));
            $title = trim((string) ($entry['title'] ?? ''));
            if ($id === '' || $title === '') {
                continue;
            }
            $groups[] = ['id' => $id, 'title' => $title];
        }

        return $groups;
    }

    /**
     * @return array{navbarTopCount: int, useSeparateNavbarOrder: bool, navbarOrder: array<int, string>, groups: array<int, array{id: string, title: string}>, items: array<int, array<string, mixed>>, version: int}
     */
    public static function navigationDefaults(): array
    {
        $items = static::defaultNavigationItems();

        return [
            'navbarTopCount' => Facts::siteModules()['navbar']['topCount'],
            'useSeparateNavbarOrder' => false,
            'navbarOrder' => array_values(array_map(fn (array $item) => (string) $item['id'], $items)),
            'groups' => static::navigationGroups(),
            'items' => $items,
            'version' => 1,
        ];
    }

    /**
     * Resolve the active site navigation configuration, merging any newly added
     * built-in tools so future code additions never vanish behind an older DB row.
     *
     * @return array{navbarTopCount: int, useSeparateNavbarOrder: bool, navbarOrder: array<int, string>, items: array<int, array<string, mixed>>, version: int}
     */
    public static function getNavigation(): array
    {
        return Cache::remember('site_navigation', 300, function () {
            $defaults = static::navigationDefaults();

            try {
                $row = static::where('key', static::SITE_NAVIGATION_KEY)->first();
                if (! $row || ! is_array($row->value)) {
                    return $defaults;
                }

                $stored = $row->value;
                $builtInById = [];
                $builtInByHref = [];
                foreach (static::defaultNavigationItems() as $builtIn) {
                    $builtInById[$builtIn['id']] = $builtIn;
                    $builtInByHref[$builtIn['href']] = $builtIn;
                }

                $seenIds = [];
                $mergedItems = [];

                if (isset($stored['items']) && is_array($stored['items'])) {
                    foreach ($stored['items'] as $idx => $raw) {
                        if (! is_array($raw)) {
                            continue;
                        }
                        $rawId = trim((string) ($raw['id'] ?? ''));
                        $rawHref = trim((string) ($raw['href'] ?? $raw['target'] ?? ''));
                        $rawTitle = trim((string) ($raw['title'] ?? $raw['text'] ?? ''));
                        if ($rawId === '' || ($rawHref === '' && $rawTitle === '')) {
                            continue;
                        }

                        $base = $builtInById[$rawId] ?? $builtInByHref[$rawId] ?? $builtInByHref[$rawHref] ?? null;
                        $canonicalId = $base['id'] ?? $rawId;
                        if (isset($seenIds[$canonicalId])) {
                            continue;
                        }
                        $seenIds[$canonicalId] = true;

                        $raw['id'] = $canonicalId;
                        $mergedItems[] = static::normalizeNavigationItem($raw, (int) $idx, $base === null, $base);
                    }
                }

                // Append any built-in items that were added in code after the DB config was saved
                foreach ($builtInById as $id => $builtIn) {
                    if (! isset($seenIds[$id])) {
                        $builtIn['sortOrder'] = count($mergedItems);
                        $mergedItems[] = $builtIn;
                        $seenIds[$id] = true;
                    }
                }

                if ($mergedItems === []) {
                    $mergedItems = $defaults['items'];
                }

                $allIds = array_values(array_map(fn (array $item) => (string) $item['id'], $mergedItems));
                $storedNavbarOrder = [];
                if (isset($stored['navbarOrder']) && is_array($stored['navbarOrder'])) {
                    foreach ($stored['navbarOrder'] as $navId) {
                        $navIdStr = (string) $navId;
                        $resolvedId = isset($builtInById[$navIdStr])
                            ? $navIdStr
                            : ($builtInByHref[$navIdStr]['id'] ?? $navIdStr);
                        if (in_array($resolvedId, $allIds, true) && ! in_array($resolvedId, $storedNavbarOrder, true)) {
                            $storedNavbarOrder[] = $resolvedId;
                        }
                    }
                }

                foreach ($allIds as $id) {
                    if (! in_array($id, $storedNavbarOrder, true)) {
                        $storedNavbarOrder[] = $id;
                    }
                }

                return [
                    'navbarTopCount' => max(1, min(10, (int) ($stored['navbarTopCount'] ?? $defaults['navbarTopCount']))),
                    'useSeparateNavbarOrder' => (bool) ($stored['useSeparateNavbarOrder'] ?? false),
                    'navbarOrder' => $storedNavbarOrder,
                    'groups' => $defaults['groups'],
                    'items' => $mergedItems,
                    'version' => (int) ($stored['version'] ?? 1),
                ];
            } catch (\Throwable) {
                return $defaults;
            }
        });
    }

    public static function flushNavigationCache(): void
    {
        Cache::forget('site_navigation');
    }
}
