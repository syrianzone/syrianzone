<?php

namespace App\Support\Agents;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\Date;
use Laravel\Sanctum\NewAccessToken;

/**
 * Mints agent API tokens under a permission *ceiling* model.
 *
 * The invariant this class exists to enforce:
 *
 *   effective permission = user's live permission AND the token's abilities
 *
 * A token can therefore only ever narrow what its owner can already do. It is
 * never a grant. Two consequences fall out of that:
 *
 *  1. Abilities are clamped to the owner's own capabilities at mint time, so
 *     you cannot hand a `transit.review_drafts`-only user a token that can
 *     approve routes.
 *  2. `*` is refused outright. Sanctum's Token::can() treats `*` as "anything",
 *     and a superadmin holding a `*` token would keep that power even after the
 *     capability is removed from `users.permissions` — because the token check
 *     would pass regardless. Narrow tokens plus the live user check avoid that.
 *
 * The token check alone is never sufficient either: revoking a permission from
 * the user must take effect on the next call, without revoking the token. That
 * is why AgentAuthorizer requires both.
 */
final class TokenIssuer
{
    /**
     * Options an admin picks from when minting. Kept short and explicit: an
     * agent credential should be rotated on a schedule, not kept forever.
     *
     * @var array<string, int>
     */
    public const TTL_OPTIONS = [
        '7d' => 7,
        '30d' => 30,
        '90d' => 90,
        '180d' => 180,
    ];

    public const DEFAULT_TTL = '30d';

    /**
     * Create a token for $owner, clamped to $abilities.
     *
     * @param  array<int, string>  $abilities  Requested capability ids. Unknown
     *                                         ids are dropped; '*' throws.
     * @return array{token: NewAccessToken, abilities: array<int, string>, dropped: array<int, string>}
     */
    public function issue(
        User $owner,
        string $name,
        array $abilities,
        string $ttl = self::DEFAULT_TTL,
    ): array {
        [$accepted, $dropped] = $this->normalise($owner, $abilities);

        $minutes = self::TTL_OPTIONS[$ttl] ?? self::TTL_OPTIONS[self::DEFAULT_TTL];

        $access = $owner->createToken(
            $name,
            $accepted,
            Date::now()->addDays($minutes),
        );

        return [
            'token' => $access,
            'abilities' => $accepted,
            'dropped' => $dropped,
        ];
    }

    /**
     * Intersect requested abilities with the owner's live capabilities.
     *
     * @param  array<int, string>  $abilities
     * @return array{0: array<int, string>, 1: array<int, string>} [accepted, dropped]
     */
    public function normalise(User $owner, array $abilities): array
    {
        $requested = array_values(array_unique(array_filter(
            array_map(static fn ($a) => is_string($a) ? trim($a) : '', $abilities),
            static fn (string $a) => $a !== '',
        )));

        if (in_array(PermissionCatalogue::WILDCARD, $requested, true)) {
            throw new InvalidTokenAbilities(
                'The "*" wildcard cannot be used as a token ability. Select the specific capabilities the agent needs.'
            );
        }

        $accepted = [];
        $dropped = [];

        foreach ($requested as $ability) {
            if (! PermissionCatalogue::isKnown($ability)) {
                $dropped[] = $ability;

                continue;
            }

            // A superadmin holds every capability, so this accepts the full
            // catalogue for them. Everyone else is capped at their own grants.
            if (! $owner->hasPermission($ability)) {
                $dropped[] = $ability;

                continue;
            }

            $accepted[] = $ability;
        }

        return [$accepted, $dropped];
    }

    /**
     * Revoke every live token for a user. Used when a human is banned, so a
     * ban is not merely advisory for agent credentials.
     */
    public function revokeAllFor(User $owner): int
    {
        return $owner->tokens()->delete();
    }
}
