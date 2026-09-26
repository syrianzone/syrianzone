<?php

namespace App\Exceptions\Users;

use RuntimeException;

/**
 * Domain refusal from user moderation.
 *
 * Transport-agnostic, like PlaceActionException, DirectoryActionException and
 * TransitActionException: the controller maps `kind` to a status code, the MCP
 * tool reports it to the agent in plain language.
 *
 * A ban is a serious action — it blocks login (AuthController), the Filament
 * panel, MCP token use (RequireApiToken) and route/place submission — so the
 * two ways to get it wrong are refusals, not failures.
 */
class UserModerationException extends RuntimeException
{
    /** Superadmins are not bannable at all. */
    public const TARGET_IS_SUPERADMIN = 'target_is_superadmin';

    /** The caller (or the agent acting for it) cannot ban its own account. */
    public const SELF_BAN = 'self_ban';

    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        public readonly string $kind,
        string $message,
        public readonly array $context = [],
    ) {
        parent::__construct($message);
    }

    public static function targetIsSuperadmin(?string $name = null): self
    {
        // The message is the exact string the endpoint has always returned, so
        // the HTTP contract is unchanged. The name goes in `context` for callers
        // that can surface it — the MCP tool does, the controller does not.
        return new self(
            self::TARGET_IS_SUPERADMIN,
            'Cannot ban a superadmin',
            array_filter(['name' => $name]),
        );
    }

    public static function selfBan(): self
    {
        return new self(
            self::SELF_BAN,
            'You cannot ban your own account: a ban takes effect immediately, so it would revoke your own access on the next request. Ask another administrator.',
        );
    }

    public function httpStatus(): int
    {
        return 403;
    }
}
