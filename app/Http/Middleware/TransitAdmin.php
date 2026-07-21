<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class TransitAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user || !$user->hasAnyPermission(['transit.review_drafts', 'transit.approve', 'transit.reject', 'transit.edit_routes'])) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            abort(403, 'Unauthorized.');
        }

        return $next($request);
    }
}
