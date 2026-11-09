<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Who may open the agent tokens page and mint, list or revoke tokens.
 *
 * Any account that holds at least one capability may manage tokens for itself.
 * That is safe because a token is a ceiling, never a grant: TokenIssuer clamps
 * its abilities to the owner's live permissions, and every agent call checks
 * the owner's permissions again. Superadmins additionally manage everyone's
 * tokens; ApiTokenAdminController narrows everything else to the caller.
 *
 * The request must come from a browser session, not a bearer token. Otherwise
 * an agent holding a narrow token could call these endpoints to mint itself a
 * fresh token with everything its owner holds, escaping its own ceiling.
 */
class AgentTokensAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $user->is_banned) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($user->currentAccessToken() instanceof PersonalAccessToken) {
            return response()->json([
                'message' => 'Agent tokens are managed from a signed-in browser session, not with an API token.',
            ], 403);
        }

        if (! $user->isSuperAdmin() && $user->effectivePermissions() === []) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return $next($request);
    }
}
