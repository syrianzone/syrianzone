<?php

namespace App\Support\Permissions;

final class UserPermissionForm
{
    public static function roleOptions(): array
    {
        return [
            'superadmin' => 'مدير عام (وصول كامل غير مقيد)',
            'user' => 'مستخدم عادي',
        ];
    }

    public static function splitPermissionFormData(array $data): array
    {
        $permissions = is_array($data['permissions'] ?? null) ? $data['permissions'] : [];

        foreach (PermissionCatalogue::groups() as $group => $options) {
            $data["perm_{$group}"] = array_values(array_intersect(array_keys($options), $permissions));
        }

        $scopes = is_array($data['permission_scopes'] ?? null) ? $data['permission_scopes'] : [];
        $data['transit_scope'] = is_array($scopes['transit'] ?? null) ? array_values($scopes['transit']) : [];

        return $data;
    }

    public static function mergePermissionFormData(array $data, array $existingScopes = []): array
    {
        $known = [];
        foreach (PermissionCatalogue::groups() as $options) {
            $known = array_merge($known, array_keys($options));
        }

        $selected = [];
        foreach (PermissionCatalogue::groups() as $group => $options) {
            $groupState = $data["perm_{$group}"] ?? [];
            unset($data["perm_{$group}"]);

            if (! is_array($groupState)) {
                continue;
            }

            foreach (array_keys($options) as $key) {
                if (in_array($key, $groupState, true)) {
                    $selected[] = $key;
                }
            }
        }

        $existing = is_array($data['permissions'] ?? null) ? $data['permissions'] : [];
        $unknown = array_values(array_diff($existing, $known));

        $data['permissions'] = array_values(array_unique(array_merge($selected, $unknown)));

        $transitScope = $data['transit_scope'] ?? [];
        unset($data['transit_scope']);

        if (is_array($transitScope) && $transitScope !== []) {
            $existingScopes['transit'] = array_values(array_filter(
                $transitScope,
                fn ($city) => is_string($city) && $city !== '',
            ));
        } else {
            unset($existingScopes['transit']);
        }

        $data['permission_scopes'] = $existingScopes === [] ? null : $existingScopes;

        return $data;
    }
}
