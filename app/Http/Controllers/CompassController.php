<?php

namespace App\Http\Controllers;

use App\Models\CompassFigure;
use App\Models\CompassPersona;
use App\Models\CompassResult;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class CompassController extends Controller
{
    /** The numeric axes, in the order the result page renders them. */
    private const AXIS_IDS = [
        'auth_lib', 'rel_sec', 'soc_cap', 'nat_glob', 'mil_pac', 'ret_rec',
        'central_federal', 'identity_civic', 'ris_communal', 'women_rights', 'sect_memory',
    ];

    /** Cache key for the public aggregate; busted whenever a run is added/removed. */
    public const PUBLIC_STATS_CACHE_KEY = 'compass-public-stats-v1';

    /** The compass test page. */
    public function index()
    {
        return Inertia::render('Compass/Index', [
            'figures' => $this->enabledFigures(),
            'personas' => $this->enabledPersonas(),
        ]);
    }

    /**
     * Public aggregate statistics: counts, per-length averages and the average
     * answer to any single question. Deliberately excludes anything that could
     * single out a run (consistency, recent submissions, timestamps).
     */
    public function stats()
    {
        return Inertia::render('Compass/Stats', [
            'stats' => $this->publicStats(),
            'personas' => CompassPersona::query()
                ->orderBy('sort_order')
                ->get(['slug', 'name'])
                ->map(fn ($p) => ['id' => $p->slug, 'name' => $p->name])
                ->all(),
        ]);
    }

    /** Public shared-result page: reconstructs the card from stored answers. */
    public function shared($shareId)
    {
        $row = CompassResult::where('share_id', $shareId)->first();
        if (! $row) {
            abort(404);
        }

        return Inertia::render('Compass/Shared', [
            'version' => $row->version,
            'answers' => $row->answers,
            'shareId' => $shareId,
            'figures' => $this->enabledFigures(),
            'personas' => $this->enabledPersonas(),
        ]);
    }

    /**
     * The admin-managed roster the matcher runs against. Only enabled rows are
     * exposed; the engine falls back to no matches when the roster is empty.
     *
     * @return array<int, array<string, mixed>>
     */
    private function enabledFigures(): array
    {
        return CompassFigure::query()
            ->where('enabled', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map->toFigurePayload()
            ->all();
    }

    /**
     * The enabled personas, in display order. The engine picks one per run.
     *
     * @return array<int, array<string, mixed>>
     */
    private function enabledPersonas(): array
    {
        return CompassPersona::query()
            ->where('enabled', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map->toPersonaPayload()
            ->all();
    }

    /**
     * Aggregate the anonymous, consented runs. Cached because it walks every
     * row's answers; the store/destroy endpoints forget the key on change.
     *
     * A "scope" is `all` or one of the three quiz lengths, so the same numbers
     * can be read overall or per length. Only aggregate counts are exposed — no
     * row can be traced back to a person.
     *
     * @return array<string, mixed>
     */
    private function publicStats(): array
    {
        return Cache::remember(self::PUBLIC_STATS_CACHE_KEY, now()->addMinutes(10), function () {
            $scopes = ['all', 'short', 'standard', 'full'];
            $byVersion = ['short' => 0, 'standard' => 0, 'full' => 0];
            $bySpectrum = [];
            $axisAcc = [];     // scope => axis => [sum, count]
            $questionAcc = []; // key => scope => [n, [c-2, c-1, c0, c+1, c+2]]
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
                    if ($row->spectrum) {
                        $bySpectrum[$row->spectrum] = ($bySpectrum[$row->spectrum] ?? 0) + 1;
                    }

                    $rowScopes = in_array($version, $scopes, true) ? ['all', $version] : ['all'];

                    foreach ($rowScopes as $scope) {
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

            arsort($bySpectrum);

            return [
                'total' => $total,
                'byVersion' => $byVersion,
                'bySpectrum' => collect($bySpectrum)
                    ->map(fn ($count, $id) => ['id' => $id, 'count' => $count])
                    ->values()
                    ->all(),
                'axisAverages' => $axisAverages,
                'questions' => $questions,
            ];
        });
    }
}
