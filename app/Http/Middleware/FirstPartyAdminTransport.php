<?php

namespace App\Http\Middleware;

use App\Support\Agents\TokenAbilities;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/** Native admin routes accept user sessions, while scoped agents keep their MCP authorizer. */
final class FirstPartyAdminTransport
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user?->is_banned) {
            return response()->json(['message' => 'هذا الحساب محظور.'], 403);
        }

        $token = $user?->currentAccessToken();
        if ($token instanceof PersonalAccessToken && ! TokenAbilities::isMobileToken($token)) {
            return response()->json(['message' => 'استخدم واجهة الوكلاء المخصصة لهذا النوع من الرموز.'], 403);
        }

        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
