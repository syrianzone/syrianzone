<?php

namespace App\Services\Promises;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Cache for the public /promises payload.
 *
 * The page ships every published promise, so an uncached render hydrates the
 * whole tracker and its relations on each visit. The payload only changes when
 * the tracker is edited or the Syrian calendar day rolls over (the countdowns
 * are whole days), so it is cached per day and dropped on any write.
 *
 * Invalidation is driven by model events on the promise tables (registered
 * in AppServiceProvider) and deferred to commit, because an edit writes the
 * promise first and its tags, governorates and sources afterwards in the same
 * transaction. The TTL is the backstop for the two things events cannot see:
 * rows written through the query builder, and speaker photos that come from
 * the candidates and official entities tables.
 */
class PromiseIndexCache
{
    public const TTL_SECONDS = 300;

    private const KEY = 'promises:index:v2:';

    /**
     * @param  Closure(): array<string, mixed>  $build
     * @return array<string, mixed>
     */
    public static function remember(CarbonImmutable $today, Closure $build): array
    {
        return Cache::remember(self::KEY.$today->format('Y-m-d'), self::TTL_SECONDS, $build);
    }

    public static function flush(): void
    {
        DB::afterCommit(function () {
            // Either side of midnight in Syria: the key is dated in Syrian time.
            $today = CarbonImmutable::now('UTC');
            foreach ([$today->subDay(), $today, $today->addDay()] as $day) {
                Cache::forget(self::KEY.$day->format('Y-m-d'));
            }
        });
    }
}
