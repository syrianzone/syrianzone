<?php

namespace App\Support\Seo;

use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\Previews;
use Illuminate\Http\Request;

/**
 * Resolves the SEO and share-preview metadata of a request: one result that
 * the root Blade view prints into <head> and <SeoHead> keeps current during
 * client-side navigation.
 *
 * Fixed pages are listed in PAGES below. Database-backed pages (a promise, a
 * poll, a place...) each have a PreviewResolver under Preview/Resolvers. Any
 * other URL gets the site defaults. See docs/guidelines/seo.md.
 */
class SeoMeta
{
    /** Request attribute the resolved metadata is memoised under. */
    private const ATTRIBUTE = 'seo_meta';

    /** Appended to a fixed page's title for the browser tab and search results. */
    private const TITLE_SUFFIX = ' | Syrian Zone';

    /**
     * Fixed pages: path => [title, description, type?, suffix?]. Each page's
     * share card is listed in resources/og/cards.json (see Og\StaticCards).
     *
     * `title` is the page's own name. The document title adds TITLE_SUFFIX
     * (unless `suffix` is false); a link preview shows the bare title, because
     * there the site name already travels in og:site_name.
     */
    private const PAGES = [
        '/' => [
            'title' => 'المساحة السورية — منصة سورية مفتوحة المصدر',
            'description' => 'المساحة السورية - منصة تفاعلية تجمع وتوفر الموارد والخدمات والمعلومات المفتوحة المتعلقة بالشأن السوري من استطلاعات رأي، وأدلة رسمية، وأطلس، وترانزيت، وهويات بصرية.',
            'suffix' => false, // the title is the brand itself
        ],
        '/tierlist' => [
            'title' => 'تير ليست الحكومة السورية',
            'description' => 'شارك في تقييم وتصنيف أداء أعضاء الحكومة السورية الجديدة عبر منصة تير ليست تفاعلية وشاركه مع الآخرين.',
            'type' => 'article',
        ],
        '/tierlist/leaderboard' => [
            'title' => 'نتائج تقييم الحكومة السورية',
            'description' => 'إحصائيات ونتائج تصويت تير ليست الحكومة السورية، المحافظين، والشخصيات العامة ببيانات تفاعلية محدثة.',
            'type' => 'article',
        ],
        '/polls' => [
            'title' => 'الاستبيانات واستطلاعات الرأي',
            'description' => 'شارك في الاستبيانات واستطلاعات الرأي المجتمعية حول مختلف القضايا والشؤون السورية.',
        ],
        '/mishwar' => [
            'title' => 'مشوار | دليل وخريطة الأماكن والخدمات والمعالم في سوريا',
            'description' => 'دليل وخريطة تفاعلية لاكتشاف وتصفح الأماكن الخدمية، المعالم، المطاعم، المقاهي، والأماكن المخفية في سوريا مع التوصيات والتقييمات.',
        ],
        '/transit' => [
            'title' => 'ترانزيت سوريا | شبكة المواصلات العامة',
            'description' => 'ترانزيت سوريا - دليل وخرائط تفاعلية لشبكات وخطوط المواصلات العامة والسرافيس في المدن السورية.',
        ],
        '/transit/studio' => [
            'title' => 'استوديو ترانزيت | رسم الخرائط',
            'description' => 'استوديو ترانزيت - ارسم خطوط المواصلات العامة، أضف المواقف، وشارك مسارك لمدن سوريا على الخريطة.',
        ],
        '/syofficial' => [
            'title' => 'الحسابات الرسمية السورية',
            'description' => 'دليل الحسابات والجهات الرسمية السورية الموثقة على منصات التواصل، مصنّف حسب القطاعات والجهات.',
        ],
        '/phonebook' => [
            'title' => 'دليل الهاتف والواتساب الخدمي',
            'description' => 'دليل أرقام الهواتف وخطوط الواتساب الرسمية للجهات الحكومية والخدمية السورية. أرقام الطوارئ، الشكاوى، والمؤسسات الرسمية.',
        ],
        '/govapps' => [
            'title' => 'دليل التطبيقات والخدمات الحكومية',
            'description' => 'دليل تفاعلي لاستكشاف، ومتابعة، وتقييم التطبيقات والخدمات الإلكترونية الصادرة عن الجهات الحكومية السورية.',
        ],
        '/sites' => [
            'title' => 'دليل المواقع السورية',
            'description' => 'دليل تفاعلي شامل للمواقع الإلكترونية والخدمات والمنصات السورية المفيدة بمختلف المجالات.',
        ],
        '/party' => [
            'title' => 'دليل الأحزاب والقوى السياسية',
            'description' => 'دليل تفاعلي للتعرف على الأحزاب، والتنظيمات، والقوى السياسية والمدنية الفاعلة في الساحة السورية.',
        ],
        '/house' => [
            'title' => 'المجلس التشريعي السوري 2026',
            'description' => 'التشكيلة النهائية لمجلس الشعب السوري 2026: مخطط القاعة، إحصائيات، وقائمة الأعضاء. المصدر: مركز عمران للدراسات الاستراتيجية.',
            'type' => 'article',
        ],
        '/justice' => [
            'title' => 'العدالة الانتقالية',
            'description' => 'العدالة الانتقالية - قوائم وإحصائيات رموز نظام الأسد والمجرمين الموقوفين لدى وزارة الداخلية السورية وهيكل القيادة العسكرية والأمنية.',
            'type' => 'article',
        ],
        '/crossings' => [
            'title' => 'الحالة الفنية للمنافذ الحدودية في سوريا',
            'description' => 'متابعة الحالة الفنية وساعات العمل للمنافذ الحدودية السورية والمعابر البرية، مع أرقام التواصل والمواقع.',
        ],
        '/atlas' => [
            'title' => 'أطلس سوريا التفاعلي',
            'description' => 'أطلس سوريا التفاعلي - منصة لاستكشاف البيانات السكانية والجغرافية والإحصائية التفصيلية لمختلف المحافظات والمدن السورية.',
        ],
        '/syid' => [
            'title' => 'الهوية البصرية السورية',
            'description' => 'عناصر الهوية البصرية السورية - دليل وموارد غير رسمية تشمل الألوان والخطوط وخريطة سوريا ونسب العلم السوري وتطبيقاته.',
        ],
        '/muslim' => [
            'title' => 'الركن الإسلامي',
            'description' => 'الركن الإسلامي - مواقيت الصلاة، قارئ القرآن بالرسم العثماني، وإذاعة القرآن الكريم، في مكان واحد.',
        ],
        '/muslim/prayer' => [
            'title' => 'مواقيت الصلاة | الركن الإسلامي',
            'description' => 'مواقيت الصلاة اليومية في سوريا حسب مدينتك وطريقة الحساب، مع عدّاد للصلاة القادمة وتتبّع الصلوات المنجزة.',
        ],
        '/muslim/quran' => [
            'title' => 'قارئ القرآن | الركن الإسلامي',
            'description' => 'قارئ القرآن بالرسم العثماني مع التلاوة الصوتية، تتبّع الآيات والكلمات، وعلامات الحفظ — يعمل دون اتصال.',
        ],
        '/muslim/radio' => [
            'title' => 'إذاعة القرآن | الركن الإسلامي',
            'description' => 'إذاعة القرآن الكريم وتلاوة مستمرة مع اختيار القارئ ومؤقت للنوم ومشغّل مصغّر يتابع القراءة.',
        ],
        '/roznama' => [
            'title' => 'الروزنامة السورية',
            'description' => 'الروزنامة السورية الرسمية: التوقيت المحلي، التاريخ الهجري والميلادي بأسماء الأشهر السورية، مواقيت الصلاة، والأعياد والعطل الرسمية للدولة السورية بموجب المرسوم 188 لعام 2025.',
        ],
        '/priorities' => [
            'title' => 'أولويات سوريا المستقبل',
            'description' => 'رتب أولوياتك للجمهورية العربية السورية المستقبلية وشاركها مع المجتمع عبر بطاقات مخصصة وتفاعلية.',
        ],
        '/compass' => [
            'title' => 'بوصلة سوريا',
            'description' => 'اكتشف موقعك السياسي على أحد عشر محوراً عبر اختبار بوصلة سوريا التفاعلي، وقارن نتائجك مع الشخصيات والقوى السياسية.',
        ],
        '/promises' => [
            'title' => 'عداد الوعود',
            'description' => 'سجل علني موثّق بالمصادر لوعود المسؤولين السوريين منذ 8 كانون الأول 2024، مع عدّاد تنازلي لكل وعد وما تحقق منه.',
        ],
        '/promises/suggest' => [
            'title' => 'اقترح وعداً — عداد الوعود',
            'description' => 'أرسل وعداً علنياً أطلقه مسؤول سوري مع رابط المصدر، ليراجعه المحررون ويضيفوه إلى عداد الوعود.',
        ],
        '/compass/stats' => [
            'title' => 'إحصاءات بوصلة سوريا',
            'description' => 'إحصاءات مجمّعة ومجهولة الهوية عن نتائج بوصلة سوريا عبر المحاور والفئات والمشاركات.',
        ],
        '/alignment' => [
            'title' => 'مواءمة البوصلة السياسية',
            'description' => 'أداة مواءمة البوصلة السياسية السورية - قارن توجهاتك وميولك مع المكونات والقوى السياسية المختلفة.',
        ],
        '/games' => [
            'title' => 'الألعاب',
            'description' => 'مجموعة ألعاب سورية تفاعلية: 2048، سوليتير، طرنيب، تركس، ومن هو؟ — العب مجاناً على المساحة السورية.',
        ],
        '/games/2048' => ['title' => '2048 | الألعاب', 'description' => 'لعبة 2048 الكلاسيكية على المساحة السورية - حرّك المربعات واجمع الأرقام للوصول إلى 2048.'],
        '/games/solitare' => ['title' => 'سوليتير | الألعاب', 'description' => 'لعبة سوليتير (كلوندايك) الكلاسيكية - رتّب البطاقات على أربعة أسس.'],
        '/games/tarneeb' => ['title' => 'طرنيب | الألعاب', 'description' => 'لعبة الطرنيب الشهيرة - العب مع شريكك ضد فريق الخصوم واجمع الطلبات.'],
        '/games/trix' => ['title' => 'تركس | الألعاب', 'description' => 'لعبة التركس الشهيرة - العب الفريقين أو اليهودية واستمتع بالذكاء والتخطيط.'],
        '/guesswho' => [
            'title' => 'لعبة من هو؟ - Guess Who',
            'description' => "تحدّ صديقك في لعبة التخمين الشهيرة 'من هو؟' بالاتصال المباشر! اطرح الأسئلة واستبعد الشخصيات لتكشف بطاقة خصمك السرية.",
        ],
        '/board' => [
            'title' => 'لوحتي | لوحة أدواتك اليومية المخصصة',
            'description' => 'لوح أدوات مخصص: الطقس، مواقيت الصلاة، المهام، الملاحظات، الأخبار، والمزيد في لوحة واحدة قابلة للتخصيص.',
        ],
        '/syrian-contributors' => [
            'title' => 'أفضل المساهمين السوريين في GitHub',
            'description' => 'قائمة وتصنيف لأكثر المطورين والمبرمجين السوريين مساهمةً في المشاريع مفتوحة المصدر على GitHub على المستويات اليومية والشهرية والسنوية.',
        ],
        '/shawarma' => [
            'title' => "@macdoos's Shawarma Tier List",
            'description' => 'تقييم وتصنيف محلات الشاورما السورية الشهيرة - قائمة مكدوس لأفضل محلات الشاورما.',
        ],
        '/stats' => [
            'title' => 'إحصائيات المنصة',
            'description' => 'إحصائيات وتقارير تفاعلية حول المنصة وزوارها والنشاط العام في المساحة السورية.',
        ],
        '/about' => [
            'title' => 'عن المنصة',
            'description' => 'تعرف على منصة المساحة السورية (Syrian Zone) - مشروع تفاعلي غير تجاري ومفتوح المصدر يقدم أدوات وموارد بالشأن السوري.',
        ],
        '/privacy' => [
            'title' => 'سياسة الخصوصية',
            'description' => 'سياسة الخصوصية لمنصة المساحة السورية - تعرف على كيفية حماية بياناتك والتقنيات المستخدمة.',
        ],
        '/terms' => [
            'title' => 'الشروط والأحكام',
            'description' => 'الشروط والأحكام لمنصة المساحة السورية - شروط الاستخدام، السلوك المقبول، وحدود المسؤولية.',
        ],
    ];

    /** Path prefixes that must not be indexed even though they are reachable. */
    private const NOINDEX_PREFIXES = [
        'admin',
        'superadmin',
        'transit/admin',
        'dashboard',
        'auth',
        'user',
        'dev',
        'mcp/admin',
        'guesswho/room',
        'compass/s',
    ];

    /**
     * JSON-LD type for the page node, keyed by path. Anything absent is a plain
     * WebPage. Kept separate from PAGES so the copy and the schema can evolve
     * independently.
     */
    private const SCHEMA = [
        '/tierlist' => 'Article',
        '/tierlist/leaderboard' => 'Article',
        '/house' => 'Article',
        '/justice' => 'Article',
        '/polls' => 'CollectionPage',
        '/mishwar' => 'CollectionPage',
        '/transit' => 'CollectionPage',
        '/syofficial' => 'CollectionPage',
        '/phonebook' => 'CollectionPage',
        '/govapps' => 'CollectionPage',
        '/sites' => 'CollectionPage',
        '/party' => 'CollectionPage',
        '/crossings' => 'CollectionPage',
        '/syid' => 'CollectionPage',
        '/muslim' => 'CollectionPage',
        '/games' => 'CollectionPage',
        '/syrian-contributors' => 'CollectionPage',
        '/shawarma' => 'CollectionPage',
        '/promises' => 'CollectionPage',
        '/promises/suggest' => 'WebPage',
        '/atlas' => 'Dataset',
        '/compass' => 'Quiz',
        '/alignment' => 'Quiz',
        '/games/2048' => 'VideoGame',
        '/games/solitare' => 'VideoGame',
        '/games/tarneeb' => 'VideoGame',
        '/games/trix' => 'VideoGame',
        '/guesswho' => 'VideoGame',
    ];

    /**
     * Parent hub breadcrumb for nested routes: path => [parentPath, parentLabel].
     */
    private const PARENT_BREADCRUMBS = [
        '/tierlist/leaderboard' => ['/tierlist', 'تير ليست الحكومة السورية'],
        '/transit/studio' => ['/transit', 'ترانزيت سوريا'],
        '/muslim/prayer' => ['/muslim', 'الركن الإسلامي'],
        '/muslim/quran' => ['/muslim', 'الركن الإسلامي'],
        '/muslim/radio' => ['/muslim', 'الركن الإسلامي'],
        '/compass/stats' => ['/compass', 'بوصلة سوريا'],
        '/promises/suggest' => ['/promises', 'عداد الوعود'],
        '/games/2048' => ['/games', 'الألعاب'],
        '/games/solitare' => ['/games', 'الألعاب'],
        '/games/tarneeb' => ['/games', 'الألعاب'],
        '/games/trix' => ['/games', 'الألعاب'],
    ];

    /**
     * The fixed pages that declare their own metadata.
     *
     * @return list<string>
     */
    public static function pagePaths(): array
    {
        return array_keys(self::PAGES);
    }

    /**
     * @return array{title:string,og_title:string,description:string,type:string,image:string,image_type:string,url:string,canonical:string,robots:string,json_ld:string,twitter_site:?string}
     */
    public static function resolve(Request $request): array
    {
        // Resolved once per request: the view composer and the Inertia shared
        // prop both ask for it on a full page load.
        if ($request->attributes->has(self::ATTRIBUTE)) {
            return $request->attributes->get(self::ATTRIBUTE);
        }

        $path = '/'.trim($request->path(), '/');
        // Resolvers go first: a record opened through a query string
        // (/mishwar?place=12) lives on the path of a fixed page.
        $preview = Previews::resolve($request, $path) ?? self::fixedPage($path) ?? self::fallback($path);
        // Structured data describes the canonical page. For such a record that
        // is the page it is a view of, not the record.
        $about = $preview->sharePath === null ? $preview : (self::fixedPage($preview->canonicalPath) ?? $preview);

        $base = rtrim((string) config('seo.base_url'), '/');
        $absolute = fn (string $relative) => $relative === '/' ? $base.'/' : $base.$relative;
        $canonical = $absolute($preview->canonicalPath);
        $twitterSite = config('seo.twitter_site');

        $meta = [
            'title' => $preview->title,
            // The title a link preview shows: the page or record's own name.
            'og_title' => $preview->shareTitle ?? $preview->title,
            'description' => $preview->description,
            'type' => $preview->type,
            'image' => self::absolute($preview->image, $base),
            'image_type' => str_contains($preview->image, '.jpg') ? 'image/jpeg' : 'image/png',
            // What a share points at. Usually the canonical page; for a record
            // opened through a query string it keeps that parameter, so each
            // record previews as itself instead of collapsing into its section.
            'url' => $absolute($preview->sharePath ?? $preview->canonicalPath),
            'canonical' => $canonical,
            'robots' => ($preview->noindex || self::isNoindex($path)) ? 'noindex, follow' : 'index, follow',
            'twitter_site' => is_string($twitterSite) && $twitterSite !== '' ? $twitterSite : null,
            'json_ld' => self::jsonLd($path, $about->schema, $about->title, $about->description, $canonical, $base, $about->parent),
        ];

        $request->attributes->set(self::ATTRIBUTE, $meta);

        return $meta;
    }

    /** A page listed in PAGES, with its card from resources/og/cards.json. */
    public static function fixedPage(string $path): ?Preview
    {
        $page = self::PAGES[$path] ?? null;
        if ($page === null) {
            return null;
        }

        return new Preview(
            title: $page['title'].(($page['suffix'] ?? true) ? self::TITLE_SUFFIX : ''),
            shareTitle: $page['title'],
            description: $page['description'],
            canonicalPath: $path,
            image: StaticCards::forPath($path) ?? StaticCards::url(StaticCards::DEFAULT),
            type: $page['type'] ?? 'website',
            schema: self::SCHEMA[$path] ?? 'WebPage',
            parent: self::PARENT_BREADCRUMBS[$path] ?? null,
        );
    }

    /** Any other URL: the site's own title, description and card. */
    private static function fallback(string $path): Preview
    {
        return new Preview(
            title: (string) config('seo.default_title'),
            description: (string) config('seo.default_description'),
            canonicalPath: $path,
            image: StaticCards::url(StaticCards::DEFAULT),
        );
    }

    /**
     * Replaces parts of the metadata already resolved for this request, for a
     * response that is not the page its URL names (a 404 above all). The
     * structured data is rebuilt so it never describes the missing page.
     *
     * @param  array{title?:string,og_title?:string,description?:string,robots?:string}  $changes
     */
    public static function override(Request $request, array $changes): void
    {
        if (isset($changes['title'])) {
            $changes['og_title'] ??= str($changes['title'])->beforeLast(self::TITLE_SUFFIX)->toString();
        }
        $meta = array_merge(self::resolve($request), $changes);
        $base = rtrim((string) config('seo.base_url'), '/');
        $meta['json_ld'] = self::jsonLd(
            '/'.trim($request->path(), '/'),
            'WebPage',
            $meta['title'],
            $meta['description'],
            $meta['canonical'],
            $base,
            null,
        );

        $request->attributes->set(self::ATTRIBUTE, $meta);
    }

    private static function isNoindex(string $path): bool
    {
        $trimmed = ltrim($path, '/');
        foreach (self::NOINDEX_PREFIXES as $prefix) {
            if ($trimmed === $prefix || str_starts_with($trimmed, $prefix.'/')) {
                return true;
            }
        }

        return false;
    }

    private static function absolute(string $image, string $base): string
    {
        if (str_starts_with($image, 'http://') || str_starts_with($image, 'https://')) {
            return $image;
        }

        return $base.'/'.ltrim($image, '/');
    }

    /**
     * Organization + WebSite + a typed page node + (for non-root) a
     * BreadcrumbList.
     *
     * Returns a ready-to-embed JSON string (the "@context" key must not pass
     * through Blade, which would treat it as a directive).
     */
    /**
     * @param  array{0:string,1:string}|null  $parent  breadcrumb parent as [path, label]
     */
    private static function jsonLd(string $path, string $schema, string $title, string $description, string $canonical, string $base, ?array $parent): string
    {
        $websiteId = $base.'/#website';
        $breadcrumbId = $canonical.'#breadcrumb';

        $graph = [
            [
                '@type' => 'Organization',
                '@id' => $base.'/#organization',
                'name' => config('seo.site_name'),
                'url' => $base.'/',
                'logo' => $base.'/assets/icon-512.png',
            ],
            [
                '@type' => 'WebSite',
                '@id' => $websiteId,
                'name' => config('seo.site_name'),
                'url' => $base.'/',
                'inLanguage' => 'ar',
                'publisher' => ['@id' => $base.'/#organization'],
            ],
        ];

        $page = [
            '@type' => $schema,
            '@id' => $canonical.'#webpage',
            'url' => $canonical,
            'name' => $title,
            'description' => $description,
            'inLanguage' => 'ar',
            'isPartOf' => ['@id' => $websiteId],
        ];

        if ($schema === 'Article') {
            $page['headline'] = $title;
            $page['publisher'] = ['@id' => $base.'/#organization'];
        }

        if ($path !== '/') {
            $page['breadcrumb'] = ['@id' => $breadcrumbId];
            $graph[] = $page;

            $items = [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'الرئيسية', 'item' => $base.'/'],
            ];

            if ($parent !== null) {
                [$parentPath, $parentLabel] = $parent;
                $items[] = ['@type' => 'ListItem', 'position' => 2, 'name' => $parentLabel, 'item' => $base.$parentPath];
                $items[] = ['@type' => 'ListItem', 'position' => 3, 'name' => $title, 'item' => $canonical];
            } else {
                $items[] = ['@type' => 'ListItem', 'position' => 2, 'name' => $title, 'item' => $canonical];
            }

            $graph[] = [
                '@type' => 'BreadcrumbList',
                '@id' => $breadcrumbId,
                'itemListElement' => $items,
            ];
        } else {
            $graph[] = $page;
        }

        // The string is printed raw inside <script> (app.blade.php and
        // SeoHead), and titles can come from visitor submissions, so `<`, `>`
        // and `&` are escaped: a "</script>" in a title must stay data.
        return (string) json_encode(
            ['@context' => 'https://schema.org', '@graph' => $graph],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP,
        );
    }
}
