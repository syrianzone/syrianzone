<?php

namespace App\Services\Users;

use App\Exceptions\Users\UserModerationException;
use App\Models\User;

/**
 * User moderation: banning and unbanning.
 *
 * Extracted from DashboardController::toggleBan so the dashboard and the agent
 * MCP surface enforce the same two refusals. A controller-only role list would
 * have meant the agent path quietly lacked them.
 *
 * A ban is not cosmetic. It blocks login, the Filament panel, MCP token use and
 * route/place submission, which is why both refusals below are hard stops
 * rather than warnings.
 */
class UserModerationService
{
    /**
     * Set a user's banned state to an explicit value.
     *
     * Explicit, not a toggle. A toggle is the wrong shape for an agent: calling
     * it twice silently undoes the first call, and an agent retrying after a
     * timeout would un-ban the user it just banned.
     *
     * @param  User  $target  The account to change.
     * @param  User|null  $actor  Who is asking, when known. Enables the self-ban guard.
     *
     * @throws UserModerationException
     */
    public function setBanned(User $target, bool $isBanned, ?User $actor = null): User
    {
        if ($target->isSuperAdmin()) {
            throw UserModerationException::targetIsSuperadmin($target->name);
        }

        // Only meaningful on the way in. Unbanning yourself is harmless, so it is
        // allowed: refusing it would strand an admin who banned themselves by
        // accident with no route back.
        if ($isBanned && $actor !== null && $actor->is($target)) {
            throw UserModerationException::selfBan();
        }

        // A no-op write is skipped so the updated_at timestamp only moves on a
        // real change, which keeps the audit trail meaningful.
        if ((bool) $target->is_banned !== $isBanned) {
            $target->is_banned = $isBanned;
            $target->save();
        }

        return $target;
    }

    /**
     * Flip the current state, for the dashboard's existing toggle UI.
     *
     * @throws UserModerationException
     */
    public function toggleBanned(User $target, ?User $actor = null): User
    {
        return $this->setBanned($target, ! (bool) $target->is_banned, $actor);
    }
}
