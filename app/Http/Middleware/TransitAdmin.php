<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class TransitAdmin
{
    /**
     * @param string ...$perms When given, require any of these specific
     * transit.* capabilities (e.g. 'transit_admin:transit.approve').
     * When omitted, require any review capability (view-level access).
     */
    public function handle(Request $request, Closure $next, string ...$perms)
    {
        $user = $request->user();

        $required = $perms !== []
            ? $perms
            : ['transit.review_drafts', 'transit.approve', 'transit.reject', 'transit.edit_routes'];

        if (!$user || !$user->hasAnyPermission($required)) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            abort(403, 'Unauthorized.');
        }

        return $next($request);
    }
}
