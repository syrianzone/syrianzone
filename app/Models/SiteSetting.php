<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SiteSetting extends Model
{
    protected $fillable = ['key', 'value', 'updated_by'];

    protected $casts = ['value' => 'array'];

    public const HOMEPAGE_POPUP_KEY = 'homepage_popup';

    public const SITE_NAVIGATION_KEY = 'site_navigation';

    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'title' => 'صوتك بيعمل فرق!',
            'description' => 'ساهم في فك الحظر عن الخدمات التقنية في سوريا. صوّت للخدمات الأكثر أهمية بالنسبة لك لتكون من أولويات العمل.',
            'buttonText' => 'صوّت الآن',
            'dismissText' => 'لاحقاً',
            'link' => 'https://unblocksyria.com',
            'version' => 1,
        ];
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

    public static function flushPopupCache(): void
    {
        Cache::forget('site_popup');
    }

    /**
     * Default canonical list of Syrian Zone navigation items (Homepage grid, Navbar, Mobile Menu, and Flutter app).
     *
     * @return array<int, array<string, mixed>>
     */
    public static function defaultNavigationItems(): array
    {
        $rawItems = [
            [
                'id' => 'roznama',
                'title' => 'الروزنامة',
                'subtitle' => 'التقويم السوري والهجري والمناسبات ومواقيت الصلاة',
                'href' => '/roznama',
                'type' => 'native',
                'target' => 'roznama',
                'iconKey' => 'roznama',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'muslim',
                'title' => 'الركن الإسلامي',
                'subtitle' => 'مواقيت الصلاة، القرآن الكريم، وإذاعة القرآن',
                'href' => '/muslim',
                'type' => 'native',
                'target' => 'muslim_hub',
                'iconKey' => 'muslim',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [
                    ['id' => 'muslim_prayer', 'title' => 'مواقيت الصلاة', 'subtitle' => 'مواقيت الصلاة اليومية والقبلة', 'href' => '/muslim/prayer', 'type' => 'native', 'target' => 'muslim_prayer', 'iconKey' => 'muslim', 'iconUrl' => null],
                    ['id' => 'muslim_quran', 'title' => 'القرآن الكريم', 'subtitle' => 'قارئ القرآن بالرسم العثماني والتلاوة', 'href' => '/muslim/quran', 'type' => 'native', 'target' => 'muslim_quran', 'iconKey' => 'muslim', 'iconUrl' => null],
                    ['id' => 'muslim_radio', 'title' => 'إذاعة القرآن', 'subtitle' => 'بث مباشر لإذاعات وتلاوات القرآن الكريم', 'href' => '/muslim/radio', 'type' => 'native', 'target' => 'muslim_radio', 'iconKey' => 'muslim', 'iconUrl' => null],
                ],
            ],
            [
                'id' => 'games',
                'title' => 'الألعاب',
                'subtitle' => 'ألعاب ورق وذكاء جماعية وفردية',
                'href' => '/games',
                'type' => 'native',
                'target' => 'games_hub',
                'iconKey' => 'games',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [
                    ['id' => 'game_tarneeb', 'title' => 'طرنيب', 'subtitle' => 'لعبة الشدة السورية الشهيرة', 'href' => '/games/tarneeb', 'type' => 'web', 'target' => '/games/tarneeb', 'iconKey' => 'games', 'iconUrl' => null],
                    ['id' => 'game_trix', 'title' => 'تركس', 'subtitle' => 'لعبة التركس الفردية والشراكة', 'href' => '/games/trix', 'type' => 'web', 'target' => '/games/trix', 'iconKey' => 'games', 'iconUrl' => null],
                    ['id' => 'game_guesswho', 'title' => 'من هو؟', 'subtitle' => 'لعبة التخمين الجماعية المباشرة', 'href' => '/guesswho', 'type' => 'web', 'target' => '/guesswho', 'iconKey' => 'games', 'iconUrl' => null],
                    ['id' => 'game_solitaire', 'title' => 'سوليتير', 'subtitle' => 'لعبة الورق الكلاسيكية', 'href' => '/games/solitare', 'type' => 'web', 'target' => '/games/solitare', 'iconKey' => 'games', 'iconUrl' => null],
                    ['id' => 'game_2048', 'title' => '2048', 'subtitle' => 'لعبة الأرقام والذكاء', 'href' => '/games/2048', 'type' => 'web', 'target' => '/games/2048', 'iconKey' => 'games', 'iconUrl' => null],
                ],
            ],
            [
                'id' => 'transit',
                'title' => 'ترانزيت',
                'subtitle' => 'شبكة وخطوط النقل العام',
                'href' => '/transit',
                'type' => 'native',
                'target' => 'transit_map',
                'iconKey' => 'transit',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [
                    ['id' => 'transit_studio', 'title' => 'استوديو ترانزيت', 'subtitle' => 'إضافة وتعديل مسارات النقل العام', 'href' => '/transit/studio', 'type' => 'native', 'target' => 'transit_studio', 'iconKey' => 'transit', 'iconUrl' => null],
                ],
            ],
            [
                'id' => 'mishwar',
                'title' => 'مشوار',
                'subtitle' => 'دليل وخريطة الأماكن والمطاعم والمقاهي في سوريا',
                'href' => '/mishwar',
                'type' => 'native',
                'target' => 'mishwar_map',
                'iconKey' => 'mishwar',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'board',
                'title' => 'لوح',
                'subtitle' => 'لوحة أدواتك اليومية المخصصة في المساحة السورية',
                'href' => '/board',
                'type' => 'web',
                'target' => '/board',
                'iconKey' => 'board',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'compass',
                'title' => 'البوصلة السياسية',
                'subtitle' => 'اختبار البوصلة السياسية السورية وتحديد توجهاتك',
                'href' => '/compass',
                'type' => 'web',
                'target' => '/compass',
                'iconKey' => 'compass',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'tierlist',
                'title' => 'تقييم الحكومة',
                'subtitle' => 'تقييم أداء الوزراء والجهات الحكومية ومشاركة الترتيب',
                'href' => '/tierlist',
                'type' => 'native',
                'target' => 'tierlist_polls',
                'iconKey' => 'tierlist',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [
                    ['id' => 'tierlist_leaderboard', 'title' => 'نتائج التقييم', 'subtitle' => 'ترتيب وإحصائيات تصويت الجمهور', 'href' => '/tierlist/leaderboard', 'type' => 'native', 'target' => 'tierlist_leaderboard', 'iconKey' => 'tierlist', 'iconUrl' => null],
                ],
            ],
            [
                'id' => 'priorities',
                'title' => 'أولويات سوريا',
                'subtitle' => 'استبيان وترتيب أولويات إعادة الإعمار والتنمية في سوريا',
                'href' => '/priorities',
                'type' => 'web',
                'target' => '/priorities',
                'iconKey' => 'priorities',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'crossings',
                'title' => 'المنافذ الحدودية',
                'subtitle' => 'حالة المعابر البرية والمطارات والمرافئ السورية لحظة بلحظة',
                'href' => '/crossings',
                'type' => 'native',
                'target' => 'crossings_status',
                'iconKey' => 'crossings',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'recipes',
                'title' => 'وصفاتنا',
                'subtitle' => 'موسوعة وصفات المطبخ السوري التقليدي الأصيل',
                'href' => 'https://food.syrian.zone',
                'type' => 'external',
                'target' => 'https://food.syrian.zone',
                'iconKey' => 'recipes',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'answers',
                'title' => 'إجابات سوريا',
                'subtitle' => 'منصة الأسئلة والأجوبة المجتمعية حول سوريا',
                'href' => 'https://answers.syrian.zone',
                'type' => 'external',
                'target' => 'https://answers.syrian.zone',
                'iconKey' => 'answers',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'syofficial',
                'title' => 'الحسابات الرسمية',
                'subtitle' => 'دليل الحسابات والصفحات الرسمية للوزارات والمؤسسات السورية',
                'href' => '/syofficial',
                'type' => 'native',
                'target' => 'syofficial_directory',
                'iconKey' => 'syofficial',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'phonebook',
                'title' => 'دليل الهاتف',
                'subtitle' => 'أرقام الطوارئ والاستعلامات والخدمات العامة في المحافظات',
                'href' => '/phonebook',
                'type' => 'native',
                'target' => 'phonebook_directory',
                'iconKey' => 'phonebook',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'sites',
                'title' => 'دليل المواقع',
                'subtitle' => 'دليل المواقع والمنصات والمبادرات الرقمية السورية',
                'href' => '/sites',
                'type' => 'web',
                'target' => '/sites',
                'iconKey' => 'sites',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'contributors',
                'title' => 'المساهمون',
                'subtitle' => 'لوحة المساهمين والمطورين في المشاريع السورية مفتوحة المصدر',
                'href' => '/syrian-contributors',
                'type' => 'web',
                'target' => '/syrian-contributors',
                'iconKey' => 'contributors',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'govapps',
                'title' => 'تطبيقات الحكومة',
                'subtitle' => 'دليل التطبيقات الحكومية والخدمية الرسمية في سوريا',
                'href' => '/govapps',
                'type' => 'native',
                'target' => 'govapps_directory',
                'iconKey' => 'govapps',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'party',
                'title' => 'دليل الأحزاب',
                'subtitle' => 'دليل الأحزاب والتيارات والكيانات السياسية السورية',
                'href' => '/party',
                'type' => 'web',
                'target' => '/party',
                'iconKey' => 'party',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'house',
                'title' => 'المجلس التشريعي',
                'subtitle' => 'مرصد المجلس التشريعي وتوزيع المقاعد والأعضاء',
                'href' => '/house',
                'type' => 'web',
                'target' => '/house',
                'iconKey' => 'house',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'justice',
                'title' => 'العدالة الانتقالية',
                'subtitle' => 'العدالة الانتقالية والتوثيق والمحاسبة',
                'href' => '/justice',
                'type' => 'web',
                'target' => '/justice',
                'iconKey' => 'justice',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'syid',
                'title' => 'الهوية البصرية',
                'subtitle' => 'دليل الهوية البصرية السورية الرسمية، الألوان والخطوط والشعارات',
                'href' => '/syid',
                'type' => 'web',
                'target' => '/syid',
                'iconKey' => 'syid',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'atlas',
                'title' => 'أطلس',
                'subtitle' => 'أطلس السكان والخرائط الديمغرافية والتقسيمات الإدارية',
                'href' => '/atlas',
                'type' => 'web',
                'target' => '/atlas',
                'iconKey' => 'atlas',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'codex',
                'title' => 'مجتمع كوديكس',
                'subtitle' => 'مجتمع المبرمجين والمصممين السوريين على ديسكورد',
                'href' => 'https://discord.gg/NqE8849VzA',
                'type' => 'external',
                'target' => 'https://discord.gg/NqE8849VzA',
                'iconKey' => 'codex',
                'iconUrl' => null,
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'flag_replacer',
                'title' => 'مبدل العلم',
                'subtitle' => 'إضافة متصفح لاستبدال العلم القديم بالعلم السوري',
                'href' => 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog',
                'type' => 'external',
                'target' => 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog',
                'iconKey' => null,
                'iconUrl' => '/flag-replacer/1f1f8-1f1fe.svg',
                'isInternal' => true,
                'subCategories' => [],
            ],
            [
                'id' => 'joory',
                'title' => 'جوري AI',
                'subtitle' => 'مساعد ذكي باللغة العربية',
                'href' => 'https://joory.chat',
                'type' => 'external',
                'target' => 'https://joory.chat',
                'iconKey' => null,
                'iconUrl' => 'https://joory.chat/favicon.svg',
                'isInternal' => false,
                'subCategories' => [],
            ],
            [
                'id' => 'jard',
                'title' => 'جرد',
                'subtitle' => 'منصة جرد',
                'href' => 'https://jard.chat',
                'type' => 'external',
                'target' => 'https://jard.chat',
                'iconKey' => null,
                'iconUrl' => 'https://jard.chat/images/logo-light.svg',
                'isInternal' => false,
                'subCategories' => [],
            ],
            [
                'id' => 'news',
                'title' => 'أخبار سوريا',
                'subtitle' => 'متابعة آخر أخبار سوريا من المصادر الموثوقة',
                'href' => 'https://news.jard.chat',
                'type' => 'external',
                'target' => 'https://news.jard.chat',
                'iconKey' => 'news',
                'iconUrl' => null,
                'isInternal' => false,
                'subCategories' => [],
            ],
        ];

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
            'navbarTopCount' => 5,
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
