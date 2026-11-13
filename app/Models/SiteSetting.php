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

        $iconUrl = null;
        if (array_key_exists('iconUrl', $raw) && ! empty($raw['iconUrl'])) {
            $iconUrl = trim((string) $raw['iconUrl']);
        } elseif (array_key_exists('image', $raw) && ! empty($raw['image'])) {
            $iconUrl = trim((string) $raw['image']);
        } elseif (! empty($base['iconUrl'])) {
            $iconUrl = (string) $base['iconUrl'];
        } elseif (! empty($base['image'])) {
            $iconUrl = (string) $base['image'];
        }

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
                $subCategories[] = [
                    'id' => trim((string) ($sub['id'] ?? ($id.'_sub_'.$subIdx))),
                    'title' => $subTitle,
                    'subtitle' => trim((string) ($sub['subtitle'] ?? '')),
                    'href' => $subHref !== '' ? $subHref : $href,
                    'type' => in_array(($sub['type'] ?? 'web'), ['native', 'web', 'external'], true) ? (string) $sub['type'] : 'web',
                    'target' => trim((string) ($sub['target'] ?? ($subHref !== '' ? $subHref : $href))),
                    'iconKey' => ! empty($sub['iconKey']) ? trim((string) $sub['iconKey']) : $iconKey,
                    'iconUrl' => ! empty($sub['iconUrl']) ? trim((string) $sub['iconUrl']) : null,
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
            'image' => $iconUrl,
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
     * @return array{navbarTopCount: int, useSeparateNavbarOrder: bool, navbarOrder: array<int, string>, items: array<int, array<string, mixed>>, version: int}
     */
    public static function navigationDefaults(): array
    {
        $items = static::defaultNavigationItems();

        return [
            'navbarTopCount' => Facts::siteModules()['navbar']['topCount'],
            'useSeparateNavbarOrder' => false,
            'navbarOrder' => array_values(array_map(fn (array $item) => (string) $item['id'], $items)),
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
