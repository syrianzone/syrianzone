<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class TransitAdmin
{
    private const PERMISSIONS = [
        'transit.approve',
        'transit.combine_routes',
        'transit.edit_routes',
        'transit.move_routes',
        'transit.reject',
        'transit.review_drafts',
        'transit.split_routes',
        'transit.view_logs',
    ];

    public function handle(Request $request, Closure $next, ?string $permission = null)
    {
        $user = $request->user();
        $requestedPermissions = $permission === null ? self::PERMISSIONS : [$permission];

        if (
            ! $user
            || $user->is_banned
            || ($permission !== null && ! in_array($permission, self::PERMISSIONS, true))
            || ! $user->hasAnyPermission($requestedPermissions)
        ) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            abort(403, 'Unauthorized.');
        }

        return $next($request);
    }
}
