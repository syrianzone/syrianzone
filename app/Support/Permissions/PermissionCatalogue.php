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

    /**
     * Capability ids grouped by module, mapped to their Arabic label.
     *
     * @return array<string, array<string, string>>
     */
    public static function groups(): array
    {
        return [
            'syofficial' => [
                'syofficial.create' => 'إنشاء الجهات والتصنيفات',
                'syofficial.edit' => 'تعديل بيانات الجهات وروابط التواصل',
                'syofficial.toggle' => 'إظهار الجهات والتصنيفات وإخفاؤها',
                'syofficial.delete' => 'حذف الجهات والتصنيفات',
                'syofficial.reorder' => 'السحب والإفلات للترتيب',
            ],
            'govapps' => [
                'govapps.create' => 'إضافة التطبيقات الحكومية',
                'govapps.edit' => 'تعديل تفاصيل التطبيقات وروابطها',
                'govapps.toggle' => 'إظهار التطبيقات وإخفاؤها',
                'govapps.delete' => 'حذف التطبيقات',
                'govapps.reorder' => 'السحب والإفلات للترتيب',
            ],
            'transit' => [
                'transit.review_drafts' => 'مراجعة المسارات المقترحة',
                'transit.approve' => 'الموافقة على المسارات ونشرها',
                'transit.reject' => 'رفض مسودات المسارات',
                'transit.edit_routes' => 'تعديل المسارات المنشورة والمواقف',
                'transit.delete_routes' => 'حذف المسارات',
            ],
            'places' => [
                'places.review' => 'مراجعة الأماكن قيد الانتظار',
                'places.approve' => 'الموافقة على الأماكن ونشرها',
                'places.edit' => 'تعديل تفاصيل الأماكن',
                'places.moderate_photos' => 'تدوير الصور وحذفها',
                'places.delete' => 'حذف الأماكن',
            ],
            'phonebook' => [
                'phonebook.create' => 'إنشاء الإدخالات والتصنيفات',
                'phonebook.edit' => 'تعديل الأرقام والأسماء والتفاصيل',
                'phonebook.toggle' => 'إظهار الإدخالات وإخفاؤها',
                'phonebook.delete' => 'حذف الإدخالات والتصنيفات',
                'phonebook.reorder' => 'السحب والإفلات للترتيب',
            ],
            'polls' => [
                'polls.create' => 'إنشاء الاستبيانات',
                'polls.edit' => 'تعديل الاستبيانات والمرشحين',
                'polls.delete' => 'حذف الاستبيانات',
            ],
            'users' => [
                'users.ban' => 'حظر المستخدمين ومنعهم من تقديم مسارات',
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
            'users' => ['label' => 'المستخدمون', 'icon' => 'users'],
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
