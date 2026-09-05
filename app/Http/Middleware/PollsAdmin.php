<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class PollsAdmin
{
    /**
     * Handle an incoming request for the Polls (& candidates) admin panel.
     * Core admins keep access; otherwise any single polls.* capability opens
     * the module (per-action splits are not enforced downstream).
     */
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (
            $user && (
                $user->isSuperAdmin() ||
                $user->role === 'admin' ||
                $user->hasAnyPermission([
                    'polls.create',
                    'polls.edit',
                    'polls.delete',
                ])
            )
        ) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        abort(403, 'Unauthorized.');
    }
}
