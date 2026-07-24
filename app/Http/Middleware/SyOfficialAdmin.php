<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SyOfficialAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user || ! $user->hasAnyPermission(['syofficial.create', 'syofficial.edit', 'syofficial.toggle', 'syofficial.delete', 'syofficial.reorder'])) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            abort(403, 'Unauthorized.');
        }

        return $next($request);
    }
}
