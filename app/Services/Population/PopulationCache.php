<?php

namespace App\Services\Population;

use Illuminate\Support\Facades\Cache;

/**
 * The cache entries of the population atlas.
 *
 * The two reports are derived from the same rows and are invalidated by the same
 * write (`UpdateSyriaClimate`), so they are written and forgotten as one thing:
 * the command must not re-spell the keys.
 */
final class PopulationCache
{
    /** The atlas master dataset (`/api/v1/population/...`). */
    public const MASTER = 'population_master';

    /** The environmental report layered on the same rows. */
    public const ENVIRONMENT = 'population_env_report';

    public static function forget(): void
    {
        Cache::forget(self::MASTER);
        Cache::forget(self::ENVIRONMENT);
    }
}
