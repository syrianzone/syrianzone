<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class TransitAdminAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token    = $request->bearerToken();
        $user     = env('TRANSIT_ADMIN_USER', 'admin');
        $pass     = env('TRANSIT_ADMIN_PASS', '');
        $expected = hash('sha256', $user . $pass . config('app.key'));

        if (!$token || !hash_equals($expected, $token)) {
            return response()->json(['message' => 'غير مصرح'], 401);
        }

        return $next($request);
    }
}
