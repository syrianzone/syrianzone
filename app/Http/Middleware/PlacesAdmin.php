<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PlacesAdmin
{
    /**
     * Handle an incoming request for the Mishwar Places moderation panel.
     * Core admins keep access; otherwise any single places.* capability opens
     * the module (per-action splits are not enforced downstream).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return redirect()->route('login');
        }

        if (
            $user->isSuperAdmin() ||
            $user->role === 'admin' ||
            $user->hasAnyPermission([
                'places.review',
                'places.approve',
                'places.edit',
                'places.moderate_photos',
                'places.delete',
            ])
        ) {
            return $next($request);
        }

        abort(403, 'Unauthorized access to Places moderation.');
    }
}
