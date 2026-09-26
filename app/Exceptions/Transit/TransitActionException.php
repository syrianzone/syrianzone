<?php

namespace App\Exceptions\Transit;

use RuntimeException;

/**
 * Domain refusal from the transit moderation service.
 *
 * Transport-agnostic, like PlaceActionException and
 * DirectoryActionException: the HTTP controller maps `kind` onto a status code,
 * the MCP tool reports it to the agent in plain language.
 *
 * These are refusals, not failures. "This draft was already approved" is a
 * correct answer to the question, and the agent should be able to recover from
 * it by reading the draft's current state — not see a 500.
 */
class TransitActionException extends RuntimeException
{
    /** The draft is no longer awaiting review. */
    public const DRAFT_NOT_PENDING = 'draft_not_pending';

    /** The route already holds the requested status. */
    public const STATUS_UNCHANGED = 'status_unchanged';

    /** A move was requested to the governorate the route is already in. */
    public const SAME_CITY = 'same_city';

    /** An update carried no recognisable fields. */
    public const NO_CHANGES = 'no_changes';

    /** A combine was asked for across two governorates. */
    public const CROSS_CITY = 'cross_city';

    /** A split was asked for at the first or last stop, or at a foreign stop. */
    public const INVALID_SPLIT_STOP = 'invalid_split_stop';

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

    public static function draftNotPending(string $currentStatus, int $draftId): self
    {
        return new self(
            self::DRAFT_NOT_PENDING,
            "Draft #{$draftId} is already {$currentStatus}; only a pending draft can be reviewed. Read the draft's current status before retrying.",
            ['draft_id' => $draftId, 'status' => $currentStatus],
        );
    }

    public static function statusUnchanged(string $status, string $routeId): self
    {
        return new self(
            self::STATUS_UNCHANGED,
            "Route {$routeId} is already {$status}.",
            ['route_id' => $routeId, 'status' => $status],
        );
    }

    public static function sameCity(string $cityId, string $routeId): self
    {
        return new self(
            self::SAME_CITY,
            "Route {$routeId} already belongs to governorate {$cityId}.",
            ['route_id' => $routeId, 'city_id' => $cityId],
        );
    }

    public static function noChanges(): self
    {
        return new self(
            self::NO_CHANGES,
            'No fields to update. Supply at least one of: name_ar, name_en, color_index, price_new, price_old.',
        );
    }

    public static function crossCity(string $message = 'Routes must belong to the same city'): self
    {
        return new self(self::CROSS_CITY, $message);
    }

    public static function invalidSplitStop(): self
    {
        return new self(
            self::INVALID_SPLIT_STOP,
            'Invalid split stop: cannot split at start or end stop. Choose a stop that belongs to this route and has at least one stop before and after it.',
        );
    }

    public function httpStatus(): int
    {
        return match ($this->kind) {
            self::DRAFT_NOT_PENDING, self::STATUS_UNCHANGED, self::SAME_CITY, self::CROSS_CITY, self::INVALID_SPLIT_STOP => 400,
            default => 422,
        };
    }
}
