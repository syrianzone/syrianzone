<?php

namespace App\Http\Middleware;

/**
 * User moderation admin — currently just banning.
 *
 * A general, application-wide capability rather than a module one, so it lives
 * outside the six content modules. The ban endpoint used to be declared inside
 * the transit_admin group, which was wrong twice over: it is called from the
 * dashboard, not the transit page, and that group gates by transit capability,
 * so holding only `transit.review_drafts` reached a user-moderation action.
 * Authorising it with a role list buried in the controller was the other half
 * of the problem — a role cannot be granted to one person without granting it
 * to everyone sharing it.
 */
class UsersAdmin extends ModuleCapabilityGuard
{
    public function alias(): string
    {
        return 'users_admin';
    }

    protected function capabilities(): array
    {
        return [
            'users.ban',
        ];
    }
}
