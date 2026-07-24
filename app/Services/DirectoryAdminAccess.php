<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;

final class DirectoryAdminAccess
{
    private const ACTIONS = ['create', 'delete', 'edit', 'reorder', 'toggle'];

    private const MODULE_ROLES = [
        'govapps' => 'govapps_admin',
        'phonebook' => 'phonebook_admin',
        'syofficial' => 'syofficial_admin',
    ];

    public function authorizeRead(Request $request, string $module): void
    {
        $user = $this->activeUser($request);
        if ($this->hasFullAccess($user, $module)) {
            return;
        }

        $permissions = array_map(
            static fn (string $action): string => "{$module}.{$action}",
            self::ACTIONS,
        );
        if (! $user->hasAnyPermission($permissions)) {
            throw new AuthorizationException('Unauthorized.');
        }
    }

    public function authorizeAction(Request $request, string $module, string $action): void
    {
        $user = $this->activeUser($request);
        if ($this->hasFullAccess($user, $module) || $user->hasPermission("{$module}.{$action}")) {
            return;
        }

        throw new AuthorizationException('Unauthorized.');
    }

    private function activeUser(Request $request): User
    {
        $user = $request->user();
        if (! $user instanceof User || $user->is_banned) {
            throw new AuthorizationException('Unauthorized.');
        }

        return $user;
    }

    private function hasFullAccess(User $user, string $module): bool
    {
        if (in_array($user->role, ['admin', 'superadmin'], true)) {
            return true;
        }

        return isset(self::MODULE_ROLES[$module])
            && $user->role === self::MODULE_ROLES[$module];
    }
}
