<?php

namespace App\Support\Agents;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Runtime authorisation for the agent/MCP surface.
 *
 * Every check is an AND of two independent facts:
 *
 *   effective = $user->hasPermission($p)  AND  $token->can($p)
 *
 * The user side is read live on every call, never snapshotted onto the token.
 * That is what makes a revocation take effect immediately: removing
 * `transit.approve` from a user, or narrowing their `permission_scopes`, stops
 * their agent on the very next tool call without anyone touching the token.
 *
 * The token side only narrows further, so a token can never be the reason a
 * call succeeds.
 *
 * All methods fail closed. A missing token, a revoked token or a null user
 * denies; there is no path that returns true because a lookup came back empty.
 */
final class AgentAuthorizer
{
    public function allows(?User $user, ?string $permission, mixed $token = null): bool
    {
        if ($user === null || $permission === null) {
            return false;
        }

        $token = $this->realToken($token);

        if ($token === null) {
            return false;
        }

        if (! in_array($permission, $this->tokenAbilities($token), true)) {
            return false;
        }

        return $user->hasPermission($permission);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    public function allowsAny(?User $user, array $permissions, mixed $token = null): bool
    {
        foreach ($permissions as $permission) {
            if ($this->allows($user, $permission, $token)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Governorate-aware variant. The scope is read live from the user, exactly
     * as the web admin does, so narrowing `permission_scopes.transit` applies
     * to agents immediately.
     */
    public function allowsInCity(?User $user, ?string $permission, ?string $cityId, mixed $token = null): bool
    {
        if (! $this->allows($user, $permission, $token)) {
            return false;
        }

        /** @var User $user */
        return $user->hasPermissionInCity($permission, $cityId);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    public function allowsAnyInCity(?User $user, array $permissions, ?string $cityId, mixed $token = null): bool
    {
        foreach ($permissions as $permission) {
            if ($this->allowsInCity($user, $permission, $cityId, $token)) {
                return true;
            }
        }

        return false;
    }

    /**
     * The capabilities this token can actually exercise right now.
     *
     * Drives `shouldRegister()` on tools so a narrow token never even sees a
     * tool it would be refused on. Advertising a tool the caller cannot use
     * wastes context and invites the agent to burn turns discovering the 403.
     *
     * @return array<int, string>
     */
    public function effectiveAbilities(?User $user, mixed $token = null): array
    {
        $token = $this->realToken($token);

        if ($user === null || $token === null) {
            return [];
        }

        $granted = $this->tokenAbilities($token);

        $effective = [];

        foreach (PermissionCatalogue::all() as $permission) {
            if (in_array($permission, $granted, true) && $user->hasPermission($permission)) {
                $effective[] = $permission;
            }
        }

        return $effective;
    }

    public function can(?User $user, string $permission, mixed $token = null): bool
    {
        return in_array($permission, $this->effectiveAbilities($user, $token), true);
    }

    /**
     * @param  array<int, string>  $required
     * @return array<int, string>
     */
    public function missing(?User $user, array $required, mixed $token = null): array
    {
        return array_values(array_filter(
            $required,
            fn (string $permission) => ! $this->can($user, $permission, $token),
        ));
    }

    /**
     * Sanctum hands back a TransientToken when a request is authenticated by a
     * first-party session cookie instead of a bearer token. That is fine for the
     * SPA but wrong here: a cookie session is not a revocable agent
     * credential, and it would bypass the ceiling entirely. RequireApiToken
     * rejects it at the edge; this is the second lock on the same door.
     */
    private function realToken(mixed $token): ?PersonalAccessToken
    {
        if ($token instanceof PersonalAccessToken) {
            return $token;
        }

        return null;
    }

    /**
     * @return array<int, string>
     */
    private function tokenAbilities(PersonalAccessToken $token): array
    {
        $abilities = $token->abilities;

        return is_array($abilities) ? $abilities : [];
    }
}
