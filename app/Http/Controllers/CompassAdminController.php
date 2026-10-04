<?php

namespace App\Http\Controllers;

use App\Models\CompassResult;
use Illuminate\Support\Facades\DB;

/**
 * Read-only admin view of the anonymised compass statistics.
 *
 * Only rows that were explicitly submitted for statistics are counted: an
 * account-saved run (`user_id` set) and a withdrawn anonymous row
 * (`stats_consent` false) are both excluded, so the numbers cannot be traced
 * back to a person and match exactly what test takers opted into sharing.
 */
class CompassAdminController extends Controller
{
    /** The numeric axes, in the same order the result page renders them. */
    private const AXIS_IDS = [
        'auth_lib', 'rel_sec', 'soc_cap', 'nat_glob', 'mil_pac', 'ret_rec',
        'central_federal', 'identity_civic', 'ris_communal', 'women_rights', 'sect_memory',
    ];

    private const BLOCS = ['west', 'gulf', 'turkish', 'east', 'neutral'];

    public function renderIndex()
    {
        return inertia('Admin/Compass/Index', [
            'stats' => $this->stats(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function stats(): array
    {
        $base = fn () => CompassResult::query()
            ->whereNull('user_id')
            ->where('stats_consent', true);

        $total = $base()->count();
        $last7 = $base()->where('created_at', '>=', now()->subDays(7))->count();
        $last30 = $base()->where('created_at', '>=', now()->subDays(30))->count();

        $byVersion = $base()
            ->selectRaw('version, count(*) as c')
            ->groupBy('version')
            ->pluck('c', 'version')
            ->map(fn ($c) => (int) $c)
            ->all();

        $bySpectrum = $base()
            ->whereNotNull('spectrum')
            ->selectRaw('spectrum, count(*) as c')
            ->groupBy('spectrum')
            ->orderByDesc('c')
            ->get()
            ->map(fn ($row) => ['id' => $row->spectrum, 'count' => (int) $row->c])
            ->all();

        $avg = $base()
            ->selectRaw('avg(consistency) as consistency, avg(answered) as answered')
            ->first();

        return [
            'total' => $total,
            'last7' => $last7,
            'last30' => $last30,
            'byVersion' => $byVersion,
            'bySpectrum' => $bySpectrum,
            'axisAverages' => $this->axisAverages($base),
            'alignTotals' => $this->alignTotals($base),
            'avgConsistency' => $avg?->consistency !== null ? round((float) $avg->consistency, 3) : null,
            'avgAnswered' => $avg?->answered !== null ? round((float) $avg->answered, 1) : null,
            'daily' => $this->daily($base),
            'recent' => $base()
                ->latest('id')
                ->limit(20)
                ->get(['id', 'created_at', 'version', 'spectrum', 'consistency', 'answered', 'top_score'])
                ->map(fn ($row) => [
                    'id' => $row->id,
                    'createdAt' => $row->created_at?->toIso8601String(),
                    'version' => $row->version,
                    'spectrum' => $row->spectrum,
                    'consistency' => $row->consistency,
                    'answered' => $row->answered,
                    'topScore' => $row->top_score,
                ])
                ->all(),
        ];
    }

    /**
     * Mean position on each axis across every anonymous run. Axes a run did not
     * answer (e.g. the transition-only axes) are left out of that axis's mean.
     *
     * @param  callable(): \Illuminate\Database\Eloquent\Builder  $base
     * @return array<string, float|null>
     */
    private function axisAverages(callable $base): array
    {
        $sums = array_fill_keys(self::AXIS_IDS, 0.0);
        $counts = array_fill_keys(self::AXIS_IDS, 0);

        foreach ($base()->whereNotNull('scores')->pluck('scores') as $scores) {
            if (! is_array($scores)) {
                continue;
            }
            foreach (self::AXIS_IDS as $axis) {
                if (isset($scores[$axis]) && is_numeric($scores[$axis])) {
                    $sums[$axis] += (float) $scores[$axis];
                    $counts[$axis]++;
                }
            }
        }

        $averages = [];
        foreach (self::AXIS_IDS as $axis) {
            $averages[$axis] = $counts[$axis] > 0 ? round($sums[$axis] / $counts[$axis], 3) : null;
        }

        return $averages;
    }

    /**
     * Summed per-bloc alignment weight across every anonymous run.
     *
     * @param  callable(): \Illuminate\Database\Eloquent\Builder  $base
     * @return array<string, float>
     */
    private function alignTotals(callable $base): array
    {
        $totals = array_fill_keys(self::BLOCS, 0.0);

        foreach ($base()->whereNotNull('align')->pluck('align') as $align) {
            if (! is_array($align)) {
                continue;
            }
            foreach (self::BLOCS as $bloc) {
                if (isset($align[$bloc]) && is_numeric($align[$bloc])) {
                    $totals[$bloc] += (float) $align[$bloc];
                }
            }
        }

        return $totals;
    }

    /**
     * A zero-filled daily series for the trailing 30 days, so the chart has a
     * point for quiet days too.
     *
     * @param  callable(): \Illuminate\Database\Eloquent\Builder  $base
     * @return array<int, array{date: string, count: int}>
     */
    private function daily(callable $base): array
    {
        $column = DB::connection()->getDriverName() === 'sqlite'
            ? "strftime('%Y-%m-%d', created_at)"
            : 'date(created_at)';

        $raw = $base()
            ->where('created_at', '>=', now()->subDays(29)->startOfDay())
            ->selectRaw("{$column} as d, count(*) as c")
            ->groupBy('d')
            ->pluck('c', 'd');

        $series = [];
        for ($i = 29; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $series[] = ['date' => $date, 'count' => (int) ($raw[$date] ?? 0)];
        }

        return $series;
    }
}
