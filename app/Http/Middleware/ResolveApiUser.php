<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolve a Sanctum bearer token on a mount that does not require `auth:sanctum`.
 *
 * Some endpoints answer both a browser session and a mobile token, and some are
 * open to guests but behave differently for a signed-in caller. Without this
 * middleware each of those controllers reached for
 * `$request->user() ?? Auth::guard('sanctum')->user()` — the same rule copied
 * per action, and only one copy also told the rest of the request about the
 * token user through `setUserResolver()`. That difference meant an action that
 * resolved a token and then called `$request->user()` (or `authorize()`) saw a
 * guest.
 *
 * Applied to the guest-allowed mounts only: inside an `auth:sanctum` group the
 * framework has already resolved and installed the user, and this is a no-op.
 */
class ResolveApiUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() === null) {
            $user = Auth::guard('sanctum')->user();

            if ($user !== null) {
                $request->setUserResolver(fn () => $user);
            }
        }

        return $next($request);
    }
}
