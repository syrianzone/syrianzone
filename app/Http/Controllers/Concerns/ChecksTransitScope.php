<?php

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Http\Request;

trait ChecksTransitScope
{
    /**
     * Abort with 403 unless the current user may exercise any of the given
     * transit capabilities in the given governorate (city). Capabilities are
     * still enforced by the transit_admin middleware; this adds the
     * governorate dimension on top.
     *
     * @param  array<int, string>  $permissions
     */
    protected function ensureTransitCityAccess(Request $request, ?string $cityId, array $permissions): void
    {
        $user = $request->user();

        if (! $user instanceof User || ! $user->hasAnyPermissionInCity($permissions, $cityId)) {
            abort(403, 'لا تملك صلاحية العمل على هذه المحافظة.');
        }
    }

    /**
     * Same as ensureTransitCityAccess but for every city that must be in
     * scope (e.g. moving a route requires access to both source and target).
     *
     * @param  array<int, string|null>  $cityIds
     * @param  array<int, string>  $permissions
     */
    protected function ensureTransitCitiesAccess(Request $request, array $cityIds, array $permissions): void
    {
        foreach ($cityIds as $cityId) {
            $this->ensureTransitCityAccess($request, $cityId, $permissions);
        }
    }

    /**
     * Governorate ids the current user may act on, or null when unrestricted.
     * A user that is not scoped (or has no transit capabilities) returns null.
     *
     * @return array<int, string>|null
     */
    protected function allowedTransitCities(Request $request): ?array
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return [];
        }

        return $user->allowedTransitCities();
    }

    /**
     * Whether the user is a transit staff member limited to specific
     * governorates. Regular community members with no transit capabilities
     * (or no scope) are never treated as scoped staff.
     */
    protected function isScopedTransitStaff(?User $user): bool
    {
        return $user instanceof User
            && $user->isTransitScopeRestricted()
            && $user->hasAnyPermission(PermissionCatalogue::forModule('transit'));
    }

    /**
     * Studio submissions are open to the community. Scope only applies to
     * staff holding transit capabilities, so a scoped transit operator cannot
     * add/edit drafts outside their governorates while regular users keep
     * their community rights.
     */
    protected function ensureStudioTransitCityAccess(Request $request, ?string $cityId): void
    {
        if ($this->canActInTransitCity($request->user(), $cityId)) {
            return;
        }

        abort(403, 'لا تملك صلاحية العمل على هذه المحافظة.');
    }

    /**
     * The boolean form of the studio rule above, for callers that decide
     * between branches instead of aborting (the studio's draft editability).
     * Unscoped users and users without transit capabilities are never limited.
     */
    protected function canActInTransitCity(?User $user, ?string $cityId): bool
    {
        if (! $user instanceof User || ! $this->isScopedTransitStaff($user)) {
            return true;
        }

        $allowed = $user->allowedTransitCities();

        return $allowed !== null && $cityId !== null && in_array($cityId, $allowed, true);
    }
}
