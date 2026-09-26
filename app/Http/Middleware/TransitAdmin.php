<?php

namespace App\Http\Middleware;

/**
 * Transit admin: draft review, approval, rejection, route edits, route deletion.
 *
 * Converted to the shared guard so there is one enforcement semantic across all
 * six admin modules. Behaviour is unchanged: the two group-level routes that
 * used to rely on the blanket fallback — the page shell and the user-ban
 * endpoint — are now tagged `any` explicitly, and the per-route tags below were
 * already correct.
 *
 * Note the governorate dimension: passing a capability here answers "may this
 * user act on the transit module at all". Whether they may act on a *specific*
 * governorate is a second question, answered in TransitAdminController via
 * ChecksTransitScope, which every mutating handler calls with its own capability.
 * MCP tools resolve the target row and then check the same scope.
 */
class TransitAdmin extends ModuleCapabilityGuard
{
    public function alias(): string
    {
        return 'transit_admin';
    }

    protected function capabilities(): array
    {
        return [
            'transit.review_drafts',
            'transit.approve',
            'transit.reject',
            'transit.edit_routes',
            'transit.delete_routes',
        ];
    }

    /**
     * Bounce to the dashboard rather than rendering a 403.
     *
     * This is the behaviour TransitAdmin had before it moved onto the shared
     * guard, and TransitRedirectTest pins it. The transit page is one click from
     * the main navigation, so a user who cannot moderate should land somewhere
     * useful rather than on an error page. API calls still get a JSON 403.
     */
    protected function forbiddenRedirect(): ?string
    {
        return '/dashboard';
    }

    protected function guestRedirect(): ?string
    {
        return '/dashboard';
    }
}
