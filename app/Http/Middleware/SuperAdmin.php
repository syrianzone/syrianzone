<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SuperAdmin
{
    public function handle(Request $request, Closure $next)
    {
        if (! $request->user()?->isSuperAdmin() || $request->user()->is_banned) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return $next($request);
    }
}
