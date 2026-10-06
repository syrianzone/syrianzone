<?php

namespace App\Support\Compass;

use App\Models\CompassResult;

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
        $scopes = self::scopes();
        $byVersion = ['short' => 0, 'standard' => 0, 'full' => 0];
        $bySpectrum = [];   // scope => id => count
        $axisAcc = [];      // scope => axis => [sum, count]
        $questionAcc = [];  // key => scope => [n, [c-2..c+2]]
        $total = 0;

        CompassResult::query()
            ->whereNull('user_id')
            ->where('stats_consent', true)
            ->get(['version', 'scores', 'spectrum', 'answers'])
            ->each(function ($row) use (&$total, &$byVersion, &$bySpectrum, &$axisAcc, &$questionAcc, $scopes) {
                $total++;
                $version = $row->version;
                if (isset($byVersion[$version])) {
                    $byVersion[$version]++;
                }

                $rowScopes = in_array($version, $scopes, true) ? ['all', $version] : ['all'];

                foreach ($rowScopes as $scope) {
                    if ($row->spectrum) {
                        $bySpectrum[$scope][$row->spectrum] = ($bySpectrum[$scope][$row->spectrum] ?? 0) + 1;
                    }

                    foreach (($row->scores ?? []) as $axisId => $value) {
                        if ($value === null || ! is_numeric($value)) {
                            continue;
                        }
                        $axisAcc[$scope][$axisId] ??= [0.0, 0];
                        $axisAcc[$scope][$axisId][0] += (float) $value;
                        $axisAcc[$scope][$axisId][1]++;
                    }

                    foreach (($row->answers ?? []) as $key => $value) {
                        if (! is_numeric($value)) {
                            continue;
                        }
                        $idx = (int) $value + 2;
                        if ($idx < 0 || $idx > 4) {
                            continue;
                        }
                        $questionAcc[$key][$scope] ??= [0, [0, 0, 0, 0, 0]];
                        $questionAcc[$key][$scope][0]++;
                        $questionAcc[$key][$scope][1][$idx]++;
                    }
                }
            });

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
