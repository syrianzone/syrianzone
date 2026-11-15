<?php

namespace App\Http\Middleware;

use App\Support\Agents\TokenAbilities;
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
 * Browser and Google-authenticated mobile sessions represent the user.
 * Scoped agent credentials cannot mint a wider token than they were issued.
 */
class AgentTokensAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $user->is_banned) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $token = $user->currentAccessToken();
        if ($token instanceof PersonalAccessToken && ! TokenAbilities::isMobileToken($token)) {
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
