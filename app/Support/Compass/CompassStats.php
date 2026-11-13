<?php

namespace App\Support\Compass;

use App\Models\CompassResult;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;

/**
 * Aggregates the anonymous, consented compass runs.
 *
 * One walk of the rows produces the three things both the public page and the
 * admin page show, each broken down by "scope" — `all` or one of the three quiz
 * lengths — so a caller can read the numbers overall or per length:
 *
 *   - axisAverages: scope => axis => mean
 *   - bySpectrum:   scope => [{id, count}]
 *   - questions:    key  => scope => {n, counts[-2..+2]}
 *
 * Only aggregate counts are produced; no row can be traced to a person.
 */
final class CompassStats
{
    /** The numeric axes, in the order the result page renders them. */
    public const AXIS_IDS = [
        'auth_lib', 'rel_sec', 'soc_cap', 'nat_glob', 'mil_pac', 'ret_rec',
        'central_federal', 'identity_civic', 'ris_communal', 'women_rights', 'sect_memory',
    ];

    /** @return array<int, string> */
    public static function scopes(): array
    {
        return ['all', 'short', 'standard', 'full'];
    }

    /**
     * The cached public aggregate. CompassStats computes it, so CompassStats
     * owns the key and the one way to drop it.
     */
    public const PUBLIC_CACHE_KEY = 'compass-public-stats-v2';

    /**
     * Drop the cached public aggregate. Any write that changes an anonymous
     * run calls this.
     */
    public static function forgetPublicCache(): void
    {
        Cache::forget(self::PUBLIC_CACHE_KEY);
    }

    /**
     * The running tally is cached under this key. Bump the suffix whenever the
     * shape of the tally (not the output) changes.
     */
    private const TALLY_KEY = 'compass-stats-tally-v2';

    /**
     * Backstop: a tally is rebuilt from scratch once it is this old, counted
     * from when it was first built. Folding in new runs does not extend it.
     */
    private const TALLY_TTL_SECONDS = 86400;

    /**
     * @return array{
     *   total: int,
     *   byVersion: array<string, int>,
     *   bySpectrum: array<string, array<int, array{id: string, count: int}>>,
     *   axisAverages: array<string, array<string, float|null>>,
     *   questions: array<string, array<string, array{n: int, counts: array<int, int>}>>
     * }
     */
    public static function aggregateAnonymous(): array
    {
        return self::present(self::tally());
    }

    /**
     * Running totals over every anonymous, consented run.
     *
     * Runs are only ever appended (and occasionally withdrawn), so the totals
     * are kept between requests and only the runs added since the last visit
     * are read and folded in. Walking every run's answers on each rebuild cost
     * about half a second at 28k runs, and the public aggregate is rebuilt
     * after every single submission.
     *
     * Two things keep it honest. A count check: if the number of runs in the
     * table no longer matches the tally (a run was withdrawn, or rows were
     * removed some other way) the tally is thrown away and rebuilt in full.
     * And a fixed deadline: a tally is rebuilt in full a day after it was first
     * built, however many runs were folded into it since, so a correction made
     * to an existing run (which leaves the count unchanged) is picked up within
     * a day rather than never.
     *
     * @return array{builtAt: int, lastId: int, total: int, byVersion: array<string, int>, bySpectrum: array<string, array<string, int>>, axis: array<string, array<string, array{0: float, 1: int}>>, questions: array<string, array<string, array{0: int, 1: array<int, int>}>>, align: array<string, float>}
     */
    public static function tally(): array
    {
        $now = now()->getTimestamp();
        $cached = Cache::get(self::TALLY_KEY);

        // Trust the cached tally only until its own deadline. The cache entry is
        // also written to expire then, but the check does not depend on that.
        if (! is_array($cached) || ! isset($cached['builtAt']) || $now - $cached['builtAt'] >= self::TALLY_TTL_SECONDS) {
            $cached = null;
        }

        $tally = self::fold($cached ?? self::emptyTally());

        if ($tally['total'] !== self::anonymousRuns()->count()) {
            $tally = self::fold(self::emptyTally());
        }

        if ($tally !== $cached) {
            // Expire at the deadline of the original build, not a day from now:
            // a put with the full lifetime on every new run would push the
            // rebuild back for as long as people kept submitting.
            $remaining = max(1, self::TALLY_TTL_SECONDS - ($now - $tally['builtAt']));
            Cache::put(self::TALLY_KEY, $tally, $remaining);
        }

        return $tally;
    }

    /** @return Builder<CompassResult> */
    private static function anonymousRuns()
    {
        return CompassResult::query()->whereNull('user_id')->where('stats_consent', true);
    }

    /** @return array<string, mixed> */
    private static function emptyTally(): array
    {
        return [
            'builtAt' => now()->getTimestamp(),
            'lastId' => 0,
            'total' => 0,
            'byVersion' => ['short' => 0, 'standard' => 0, 'full' => 0],
            'bySpectrum' => [],  // scope => id => count
            'axis' => [],        // scope => axis => [sum, count]
            'questions' => [],   // key => scope => [n, [c-2..c+2]]
            'align' => [],       // bloc => summed weight
        ];
    }

    /**
     * Add every run newer than the tally's high-water mark to it.
     *
     * Rows are read as plain rows through a cursor and the JSON columns decoded
     * by hand: hydrating an Eloquent model per run (and running its casts) cost
     * several times the query itself.
     *
     * @param  array<string, mixed>  $tally
     * @return array<string, mixed>
     */
    private static function fold(array $tally): array
    {
        $scopes = self::scopes();

        $decode = static function ($json): array {
            $value = is_string($json) ? json_decode($json, true) : $json;

            return is_array($value) ? $value : [];
        };

        $rows = self::anonymousRuns()
            ->where('id', '>', $tally['lastId'])
            ->orderBy('id')
            ->toBase()
            ->select(['id', 'version', 'scores', 'spectrum', 'answers', 'align'])
            ->cursor();

        foreach ($rows as $row) {
            $tally['lastId'] = (int) $row->id;
            $tally['total']++;

            $version = $row->version;
            if (isset($tally['byVersion'][$version])) {
                $tally['byVersion'][$version]++;
            }

            $scores = $decode($row->scores);
            $answers = $decode($row->answers);

            foreach ($decode($row->align) as $bloc => $weight) {
                if (is_numeric($weight)) {
                    $tally['align'][$bloc] = ($tally['align'][$bloc] ?? 0.0) + (float) $weight;
                }
            }

            $rowScopes = in_array($version, $scopes, true) ? ['all', $version] : ['all'];

            foreach ($rowScopes as $scope) {
                if ($row->spectrum) {
                    $tally['bySpectrum'][$scope][$row->spectrum] = ($tally['bySpectrum'][$scope][$row->spectrum] ?? 0) + 1;
                }

                foreach ($scores as $axisId => $value) {
                    if ($value === null || ! is_numeric($value)) {
                        continue;
                    }
                    $tally['axis'][$scope][$axisId] ??= [0.0, 0];
                    $tally['axis'][$scope][$axisId][0] += (float) $value;
                    $tally['axis'][$scope][$axisId][1]++;
                }

                foreach ($answers as $key => $value) {
                    if (! is_numeric($value)) {
                        continue;
                    }
                    $idx = (int) $value + 2;
                    if ($idx < 0 || $idx > 4) {
                        continue;
                    }
                    $tally['questions'][$key][$scope] ??= [0, [0, 0, 0, 0, 0]];
                    $tally['questions'][$key][$scope][0]++;
                    $tally['questions'][$key][$scope][1][$idx]++;
                }
            }
        }

        return $tally;
    }

    /**
     * The public shape of a tally: averages instead of sums, sorted personas.
     *
     * @param  array<string, mixed>  $tally
     * @return array<string, mixed>
     */
    public static function present(array $tally): array
    {
        $scopes = self::scopes();
        $total = $tally['total'];
        $byVersion = $tally['byVersion'];
        $bySpectrum = $tally['bySpectrum'];
        $axisAcc = $tally['axis'];
        $questionAcc = $tally['questions'];

        $axisAverages = [];
        foreach ($scopes as $scope) {
            foreach (self::AXIS_IDS as $axis) {
                [$sum, $count] = $axisAcc[$scope][$axis] ?? [0.0, 0];
                $axisAverages[$scope][$axis] = $count > 0 ? round($sum / $count, 3) : null;
            }
        }

        $questions = [];
        foreach ($questionAcc as $key => $byScope) {
            foreach ($byScope as $scope => [$n, $counts]) {
                $questions[$key][$scope] = ['n' => $n, 'counts' => $counts];
            }
        }

        $spectrumByScope = [];
        foreach ($scopes as $scope) {
            $counts = $bySpectrum[$scope] ?? [];
            arsort($counts);
            $spectrumByScope[$scope] = collect($counts)
                ->map(fn ($count, $id) => ['id' => $id, 'count' => $count])
                ->values()
                ->all();
        }

        return [
            'total' => $total,
            'byVersion' => $byVersion,
            'bySpectrum' => $spectrumByScope,
            'axisAverages' => $axisAverages,
            'questions' => $questions,
        ];
    }
}
