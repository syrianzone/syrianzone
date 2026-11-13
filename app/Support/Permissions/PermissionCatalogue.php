<?php

namespace App\Support\Permissions;

/**
 * The single source of truth for capability ids.
 *
 * These ids are stored verbatim in `users.permissions` and, since the agent
 * API work, also in `personal_access_tokens.abilities`. Previously the list
 * lived only inside UserResource::permissionGroups(), which made it
 * unreachable from the token issuer and the MCP authorizer without importing a
 * Filament resource into non-UI code. It now lives here and UserResource
 * delegates to it, so there is exactly one list to update when a module gains a
 * capability.
 *
 * The same list is mirrored for TypeScript in `resources/data/capabilities.json`
 * so an id used in React is a compile error when it is not real here. The two
 * are kept equal by `tests/Unit/CapabilityCatalogueParityTest.php`; use the
 * named constants below rather than writing an id as a string literal, so a
 * rename stays a single edit.
 */
final class PermissionCatalogue
{
    /**
     * Wildcard accepted inside `users.permissions` to mean "everything".
     *
     * It is deliberately NOT valid as a token ability: see TokenIssuer, which
     * refuses to persist it so a token can never be minted that outlives a
     * permission revocation.
     */
    public const WILDCARD = '*';

    public const SYOFFICIAL_CREATE = 'syofficial.create';

    public const SYOFFICIAL_EDIT = 'syofficial.edit';

    public const SYOFFICIAL_TOGGLE = 'syofficial.toggle';

    public const SYOFFICIAL_DELETE = 'syofficial.delete';

    public const SYOFFICIAL_REORDER = 'syofficial.reorder';

    public const GOVAPPS_CREATE = 'govapps.create';

    public const GOVAPPS_EDIT = 'govapps.edit';

    public const GOVAPPS_TOGGLE = 'govapps.toggle';

    public const GOVAPPS_DELETE = 'govapps.delete';

    public const GOVAPPS_REORDER = 'govapps.reorder';

    public const TRANSIT_REVIEW_DRAFTS = 'transit.review_drafts';

    public const TRANSIT_APPROVE = 'transit.approve';

    public const TRANSIT_REJECT = 'transit.reject';

    public const TRANSIT_EDIT_ROUTES = 'transit.edit_routes';

    public const TRANSIT_DELETE_ROUTES = 'transit.delete_routes';

    public const PLACES_REVIEW = 'places.review';

    public const PLACES_APPROVE = 'places.approve';

    public const PLACES_EDIT = 'places.edit';

    public const PLACES_MODERATE_PHOTOS = 'places.moderate_photos';

    public const PLACES_DELETE = 'places.delete';

    public const PHONEBOOK_CREATE = 'phonebook.create';

    public const PHONEBOOK_EDIT = 'phonebook.edit';

    public const PHONEBOOK_TOGGLE = 'phonebook.toggle';

    public const PHONEBOOK_DELETE = 'phonebook.delete';

    public const PHONEBOOK_REORDER = 'phonebook.reorder';

    public const POLLS_CREATE = 'polls.create';

    public const POLLS_EDIT = 'polls.edit';

    public const POLLS_DELETE = 'polls.delete';

    public const COMPASS_STATS = 'compass.stats';

    public const COMPASS_FIGURES = 'compass.figures';

    public const COMPASS_PERSONAS = 'compass.personas';

    public const PROMISES_CREATE = 'promises.create';

    public const PROMISES_EDIT = 'promises.edit';

    public const PROMISES_RULE = 'promises.rule';

    public const PROMISES_REVIEW = 'promises.review';

    public const PROMISES_SPEAKERS = 'promises.speakers';

    public const PROMISES_DELETE = 'promises.delete';

    public const USERS_BAN = 'users.ban';

    public const GUESSWHO_MANAGE = 'guesswho.manage';

    public const ASSETS_MANAGE = 'assets.manage';

    public const SITE_POPUP = 'site.popup';

    public const SITE_NAVIGATION = 'site.navigation';

    /**
     * Capability ids grouped by module, mapped to their Arabic label.
     *
     * @return array<string, array<string, string>>
     */
    public static function groups(): array
    {
        return [
            'syofficial' => [
                self::SYOFFICIAL_CREATE => 'إنشاء الجهات والتصنيفات',
                self::SYOFFICIAL_EDIT => 'تعديل بيانات الجهات وروابط التواصل',
                self::SYOFFICIAL_TOGGLE => 'إظهار الجهات والتصنيفات وإخفاؤها',
                self::SYOFFICIAL_DELETE => 'حذف الجهات والتصنيفات',
                self::SYOFFICIAL_REORDER => 'السحب والإفلات للترتيب',
            ],
            'govapps' => [
                self::GOVAPPS_CREATE => 'إضافة التطبيقات الحكومية',
                self::GOVAPPS_EDIT => 'تعديل تفاصيل التطبيقات وروابطها',
                self::GOVAPPS_TOGGLE => 'إظهار التطبيقات وإخفاؤها',
                self::GOVAPPS_DELETE => 'حذف التطبيقات',
                self::GOVAPPS_REORDER => 'السحب والإفلات للترتيب',
            ],
            'transit' => [
                self::TRANSIT_REVIEW_DRAFTS => 'مراجعة المسارات المقترحة',
                self::TRANSIT_APPROVE => 'الموافقة على المسارات ونشرها',
                self::TRANSIT_REJECT => 'رفض مسودات المسارات',
                self::TRANSIT_EDIT_ROUTES => 'تعديل المسارات المنشورة والمواقف',
                self::TRANSIT_DELETE_ROUTES => 'حذف المسارات',
            ],
            'places' => [
                self::PLACES_REVIEW => 'مراجعة الأماكن قيد الانتظار',
                self::PLACES_APPROVE => 'الموافقة على الأماكن ونشرها',
                self::PLACES_EDIT => 'تعديل تفاصيل الأماكن',
                self::PLACES_MODERATE_PHOTOS => 'تدوير الصور وحذفها',
                self::PLACES_DELETE => 'حذف الأماكن',
            ],
            'phonebook' => [
                self::PHONEBOOK_CREATE => 'إنشاء الإدخالات والتصنيفات',
                self::PHONEBOOK_EDIT => 'تعديل الأرقام والأسماء والتفاصيل',
                self::PHONEBOOK_TOGGLE => 'إظهار الإدخالات وإخفاؤها',
                self::PHONEBOOK_DELETE => 'حذف الإدخالات والتصنيفات',
                self::PHONEBOOK_REORDER => 'السحب والإفلات للترتيب',
            ],
            'polls' => [
                self::POLLS_CREATE => 'إنشاء الاستبيانات',
                self::POLLS_EDIT => 'تعديل الاستبيانات والمرشحين',
                self::POLLS_DELETE => 'حذف الاستبيانات',
            ],
            'compass' => [
                self::COMPASS_STATS => 'عرض إحصاءات «بوصلة سوريا» المجهولة',
                self::COMPASS_FIGURES => 'إدارة شخصيات البوصلة (إضافة وتعديل وتفعيل)',
                self::COMPASS_PERSONAS => 'إدارة أنماط البوصلة ونطاقاتها ومحتواها',
            ],
            'promises' => [
                self::PROMISES_CREATE => 'إضافة الوعود',
                self::PROMISES_EDIT => 'تعديل الوعود ومصادرها وسجل تقدّمها',
                self::PROMISES_RULE => 'الحكم على الوعود وتغيير حالتها',
                self::PROMISES_REVIEW => 'مراجعة الاقتراحات والبلاغات ونشر الوعود',
                self::PROMISES_SPEAKERS => 'إدارة قائمة أصحاب التصريحات والقطاعات',
                self::PROMISES_DELETE => 'حذف الوعود',
            ],
            'users' => [
                self::USERS_BAN => 'حظر المستخدمين ومنعهم من تقديم مسارات',
            ],
            'guesswho' => [
                self::GUESSWHO_MANAGE => 'إدارة شخصيات لعبة «مَنْ هُوَ؟» وتصنيفاتها',
            ],
            'assets' => [
                self::ASSETS_MANAGE => 'إدارة الملفات المرفوعة على الاستضافة',
            ],
            'site' => [
                self::SITE_POPUP => 'تعديل النافذة المنبثقة للصفحة الرئيسية',
                self::SITE_NAVIGATION => 'تعديل القوائم والأيقونات في الموقع',
            ],
        ];
    }

    /**
     * Display metadata per module group: heading label and project icon.
     *
     * @return array<string, array{label: string, icon: string}>
     */
    public static function groupMeta(): array
    {
        return [
            'syofficial' => ['label' => 'الحسابات الرسمية', 'icon' => 'syofficial'],
            'govapps' => ['label' => 'التطبيقات الحكومية', 'icon' => 'govapps'],
            'transit' => ['label' => 'ترانزيت', 'icon' => 'transit'],
            'places' => ['label' => 'مشوار', 'icon' => 'places'],
            'phonebook' => ['label' => 'دليل الهاتف', 'icon' => 'phonebook'],
            'polls' => ['label' => 'الاستبيانات', 'icon' => 'polls'],
            'compass' => ['label' => 'بوصلة سوريا', 'icon' => 'compass'],
            'promises' => ['label' => 'عداد الوعود', 'icon' => 'promises'],
            'users' => ['label' => 'المستخدمون', 'icon' => 'users'],
            'guesswho' => ['label' => 'لعبة مَنْ هُوَ؟', 'icon' => 'games'],
            'assets' => ['label' => 'ملفات الاستضافة', 'icon' => 'assets'],
            'site' => ['label' => 'إعدادات الموقع', 'icon' => 'site'],
        ];
    }

    /**
     * Every known capability id, as a flat list of values.
     *
     * Values, not keys: callers (and isKnown) search this with in_array(), so
     * returning the id => label map would search Arabic labels instead.
     *
     * @return array<int, string>
     */
    public static function all(): array
    {
        return array_merge(...array_values(array_map('array_keys', self::groups())));
    }

    /**
     * @return array<int, string>
     */
    public static function forModule(string $module): array
    {
        return array_keys(self::groups()[$module] ?? []);
    }

    public static function isKnown(string $permission): bool
    {
        return in_array($permission, self::all(), true);
    }

    /**
     * The Arabic label for a capability, or the raw id when unknown.
     *
     * Used for audit rows and tool error messages so a human reading the audit
     * trail does not have to memorise the dotted ids.
     */
    public static function label(string $permission): string
    {
        foreach (self::groups() as $options) {
            if (isset($options[$permission])) {
                return $options[$permission];
            }
        }

        return $permission;
    }
}
