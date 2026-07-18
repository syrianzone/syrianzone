<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class TransitAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user || $user->is_banned || ($user->role !== 'admin' && $user->role !== 'transit_admin' && $user->role !== 'superadmin')) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            abort(403, 'Unauthorized.');
        }

        return $next($request);
    }
}
