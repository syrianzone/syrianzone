<?php

namespace App\Services\Polls;

use Illuminate\Validation\Rule;

/**
 * Validation rules and vocabulary for poll candidate listings.
 *
 * The legacy leaderboard, the tier-list pages and the public API all filter
 * candidates by the same status set, and the set is not the column's set:
 * `former` is the public name for the `archived` column value. Defined once so
 * a filter cannot validate on one surface and 422 on another.
 */
final class PollRules
{
    /** Canonical filters: the public vocabulary. */
    public const STATUSES = ['active', 'former', 'all'];

    /** The stored `candidates.status` value the public calls "former". */
    public const DB_STATUS_ALIAS = 'archived';

    /**
     * The query-string status filter. The alias is accepted as an alias, never
     * as a separate value.
     *
     * @return array<int, mixed>
     */
    public function statusFilter(): array
    {
        return ['sometimes', 'string', Rule::in([...self::STATUSES, self::DB_STATUS_ALIAS])];
    }

    public static function normalizeStatus(string $status): string
    {
        return $status === self::DB_STATUS_ALIAS ? 'former' : $status;
    }
}
