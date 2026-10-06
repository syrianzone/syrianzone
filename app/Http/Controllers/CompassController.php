<?php

namespace App\Http\Controllers;

use App\Models\CompassFigure;
use App\Models\CompassPersona;
use App\Models\CompassResult;
use App\Support\Compass\CompassStats;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class CompassController extends Controller
{
    /** Cache key for the public aggregate; busted whenever a run is added/removed. */
    public const PUBLIC_STATS_CACHE_KEY = 'compass-public-stats-v2';

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
        return Cache::remember(
            self::PUBLIC_STATS_CACHE_KEY,
            now()->addMinutes(10),
            fn () => CompassStats::aggregateAnonymous()
        );
    }
}
