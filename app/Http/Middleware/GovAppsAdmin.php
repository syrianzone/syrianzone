<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class GovAppsAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user || !$user->hasAnyPermission(['govapps.create', 'govapps.edit', 'govapps.toggle', 'govapps.delete', 'govapps.reorder'])) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            abort(403, 'Unauthorized.');
        }

        return $next($request);
    }
}
