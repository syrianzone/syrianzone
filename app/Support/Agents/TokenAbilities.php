<?php

namespace App\Support\Agents;

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
}
