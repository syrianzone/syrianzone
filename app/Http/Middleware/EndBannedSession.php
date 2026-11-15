<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * End the session of a user who has been banned since signing in.
 *
 * Login refuses banned users, but a session (and its ~400-day remember-me
 * cookie) that was already open outlived the ban, so a ban took effect only
 * when the user next signed in. This runs wherever a session exists, web and
 * first-party API alike, and answers the request itself instead of letting it
 * continue as a guest: it can then never run after `auth` and leave a
 * controller holding a user who is no longer there.
 *
 * Bearer tokens are covered separately, in AppServiceProvider, where Sanctum
 * is told that a banned owner's token does not authenticate.
 */
class EndBannedSession
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->hasSession()) {
            return $next($request);
        }

        $user = Auth::guard('web')->user();

        if ($user === null || ! $user->is_banned) {
            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json(['message' => 'تم حظر حسابك.'], 403);
        }

        return redirect('/?error=banned');
    }
}
