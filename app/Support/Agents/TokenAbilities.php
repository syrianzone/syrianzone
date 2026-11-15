<?php

namespace App\Support\Agents;

use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * The abilities a Sanctum token can carry, named once.
 *
 * `mobile` marks a Flutter session: the Google-token exchange in AuthController
 * mints it, the MCP gate refuses it, and the token admin page hides it because
 * a phone session is not an agent credential. Membership is what decides that,
 * never array identity — a token that ever carries `mobile` next to another
 * ability is still a phone session, whatever the order.
 */
final class TokenAbilities
{
    public const MOBILE = 'mobile';

    public static function isMobileToken(?PersonalAccessToken $token): bool
    {
        return $token instanceof PersonalAccessToken
            && in_array(self::MOBILE, $token->abilities ?? [], true);
    }

    /**
     * Whether a token may authenticate this request at all.
     *
     * Only two kinds of token are minted: phone sessions (`mobile`) and agent
     * credentials (TokenIssuer, abilities = capability ids). An agent token's
     * ceiling is enforced by the MCP gate and nowhere else; on any other route
     * Sanctum would hand back the owner with their full rights, so a token
     * scoped to one capability could read every admin page, edit the owner's
     * account or delete it. Agent tokens therefore authenticate only on the
     * MCP endpoint. A banned owner's token authenticates nowhere.
     */
    public static function authenticates(PersonalAccessToken $token, Request $request): bool
    {
        if ((bool) $token->tokenable?->is_banned) {
            return false;
        }

        return self::isMobileToken($token) || $request->is('mcp', 'mcp/*');
    }
}
