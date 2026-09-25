<?php

namespace App\Http\Middleware;

use App\Support\Agents\AgentContext;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate for the /mcp/* agent surface.
 *
 * `auth:sanctum` on its own is too permissive for this route. Because the
 * project calls `$middleware->statefulApi()`, Sanctum will happily authenticate
 * a request from a first-party session cookie and hand back a TransientToken.
 * That would let any logged-in admin's browser act as an agent with no
 * revocable credential and no audit trail naming a token.
 *
 * So this middleware insists on a real PersonalAccessToken, rejects banned
 * owners, and binds an AgentContext that every tool authorises through.
 */
class RequireApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();

        if (! $token instanceof PersonalAccessToken) {
            return $this->deny(
                $request,
                'This endpoint requires a bearer API token. Session-cookie authentication is not accepted for agent access.'
            );
        }

        // Defensive: a token whose morph does not match the authenticated user
        // would mean the two were resolved from different sources. Refuse
        // rather than guess.
        if ($token->tokenable_id !== null && (string) $token->tokenable_id !== (string) $user->getAuthIdentifier()) {
            return $this->deny($request, 'Token does not belong to the authenticated user.');
        }

        if ($token->expires_at !== null && $token->expires_at->isPast()) {
            return $this->deny($request, 'This API token has expired. Ask a superadmin to issue a new one.');
        }

        // is_banned is checked at login and in Filament's canAccessPanel, but
        // not on the existing admin endpoints — a token outlives the session
        // that created it, so a ban has to be enforced here or it is advisory.
        if ($user->is_banned) {
            return $this->deny($request, 'This account is banned.');
        }

        app()->instance(AgentContext::class, AgentContext::for($user, $token));

        return $next($request);
    }

    private function deny(Request $request, string $message): Response
    {
        return response()->json([
            'error' => $message,
        ], 403, [
            'WWW-Authenticate' => 'Bearer realm="mcp"',
        ]);
    }
}
