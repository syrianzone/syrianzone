<?php

namespace App\Http\Controllers;

use App\Models\CompassFigure;
use App\Models\CompassPersona;
use App\Models\CompassResult;
use App\Support\Compass\CompassStats;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Admin area for the compass: anonymised statistics (read-only) plus the CRUD
 * that manages the character/personality roster.
 *
 * Statistics only count rows explicitly submitted for statistics (`stats_consent`
 * true, `user_id` null), so the numbers cannot be traced back to a person. The
 * roster is disabled by default; only enabled figures are handed to the client.
 */
class CompassAdminController extends Controller
{
    private const BLOCS = ['west', 'gulf', 'turkish', 'east', 'neutral'];

    /** Selectable persona icons. Mirrors the map in components/SpectrumIcon.tsx. */
    public const PERSONA_ICONS = [
        'Wrench', 'Landmark', 'MoonStar', 'Flag', 'Globe',
        'Scale', 'HeartHandshake', 'Puzzle', 'ScrollText', 'Shield',
    ];

    public function renderIndex(Request $request)
    {
        return inertia('Admin/Compass/Index', [
            'stats' => $this->stats(),
            'personas' => CompassPersona::query()
                ->orderBy('sort_order')
                ->get(['slug', 'name'])
                ->map(fn ($p) => ['id' => $p->slug, 'name' => $p->name])
                ->all(),
            'canManageFigures' => (bool) $request->user()?->hasPermission('compass.figures'),
            'canManagePersonas' => (bool) $request->user()?->hasPermission('compass.personas'),
        ]);
    }

    /** The character/personality manager. */
    public function renderFigures(Request $request)
    {
        return inertia('Admin/Compass/Figures', [
            'figures' => $this->allFigures(),
            'categories' => CompassFigure::CATEGORIES,
            'axes' => CompassStats::AXIS_IDS,
            'canViewStats' => (bool) $request->user()?->hasPermission('compass.stats'),
        ]);
    }

    /** JSON list for the manager (kept alongside the Inertia props for refresh). */
    public function figuresList()
    {
        return response()->json(['success' => true, 'figures' => $this->allFigures()]);
    }

    public function storeFigure(Request $request)
    {
        $data = $request->validate($this->figureRules());

        $figure = CompassFigure::create([
            'name' => $data['name'],
            'category' => $data['category'],
            'align' => $data['align'] ?? 'neutral',
            'positions' => $this->positionsFromInput($data['positions'] ?? []),
            'image_url' => $data['image_url'] ?? null,
            'image_path' => $data['image_path'] ?? null,
            'enabled' => (bool) ($data['enabled'] ?? false),
            'sort_order' => (int) ($data['sort_order'] ?? ((int) CompassFigure::max('sort_order')) + 1),
        ]);

        return response()->json(['success' => true, 'figure' => $figure->toAdminPayload()]);
    }

    public function updateFigure(Request $request, $id)
    {
        $figure = CompassFigure::findOrFail($id);
        $data = $request->validate($this->figureRules($figure));

        $figure->update([
            'name' => $data['name'],
            'category' => $data['category'],
            'align' => $data['align'] ?? 'neutral',
            'positions' => $this->positionsFromInput($data['positions'] ?? []),
            'image_url' => $data['image_url'] ?? null,
            'image_path' => $data['image_path'] ?? null,
            'enabled' => (bool) ($data['enabled'] ?? $figure->enabled),
            'sort_order' => (int) ($data['sort_order'] ?? $figure->sort_order),
        ]);

        return response()->json(['success' => true, 'figure' => $figure->fresh()->toAdminPayload()]);
    }

    public function destroyFigure($id)
    {
        $figure = CompassFigure::findOrFail($id);

        // Best-effort cleanup of the uploaded portrait, but only under our own
        // prefix so a tampered value can never delete an unrelated object.
        if ($figure->image_path && str_starts_with($figure->image_path, 'compass/')) {
            try {
                Storage::disk(config('filesystems.disks.r2.bucket') ? 'r2' : 'public')->delete($figure->image_path);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $figure->delete();

        return response()->json(['success' => true]);
    }

    public function toggleFigure($id)
    {
        $figure = CompassFigure::findOrFail($id);
        $figure->update(['enabled' => ! $figure->enabled]);

        return response()->json(['success' => true, 'enabled' => $figure->enabled]);
    }

    /**
     * Upload a portrait. Uses the R2 disk when configured; falls back to the
     * public disk so the manager still works in local development.
     */
    public function uploadFigureImage(Request $request)
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ]);

        $file = $request->file('image');
        $base = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)) ?: 'figure';
        $filename = $base.'-'.Str::random(8).'.'.strtolower($file->getClientOriginalExtension());

        if (config('filesystems.disks.r2.bucket')) {
            $path = 'compass/figures/'.$filename;
            $disk = Storage::disk('r2');
            $disk->putFileAs('compass/figures', $file, $filename, 'public');

            return response()->json(['success' => true, 'path' => $path, 'url' => $disk->url($path)]);
        }

        // Local fallback (no R2 configured): stored under the public disk.
        $rel = 'images/compass/figures/'.$filename;
        Storage::disk('public')->putFileAs('images/compass/figures', $file, $filename);

        return response()->json(['success' => true, 'path' => $rel, 'url' => '/storage/'.$rel]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allFigures(): array
    {
        return CompassFigure::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map->toAdminPayload()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function figureRules(?CompassFigure $figure = null): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('compass_figures', 'name')->ignore($figure?->id)],
            'category' => ['required', Rule::in(CompassFigure::CATEGORIES)],
            'align' => ['nullable', 'string', 'max:64'],
            'enabled' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'image_path' => ['nullable', 'string', 'max:1024'],
            'positions' => ['required', 'array'],
            'positions.*' => ['nullable', 'numeric', 'min:-1', 'max:1'],
        ];
    }

    /**
     * Normalise the submitted positions to exactly the known axes.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, float|null>
     */
    private function positionsFromInput(array $input): array
    {
        $positions = [];
        foreach (CompassStats::AXIS_IDS as $axis) {
            $value = $input[$axis] ?? null;
            $positions[$axis] = ($value === '' || $value === null) ? null : round((float) $value, 4);
        }

        return $positions;
    }

    // ---------------- personas ----------------

    /** The persona (spectrum) manager. */
    public function renderPersonas(Request $request)
    {
        return inertia('Admin/Compass/Personas', [
            'personas' => $this->allPersonas(),
            'axes' => CompassStats::AXIS_IDS,
            'icons' => self::PERSONA_ICONS,
            'canViewStats' => (bool) $request->user()?->hasPermission('compass.stats'),
        ]);
    }

    public function personasList()
    {
        return response()->json(['success' => true, 'personas' => $this->allPersonas()]);
    }

    public function storePersona(Request $request)
    {
        $data = $request->validate($this->personaRules());

        $persona = CompassPersona::create([
            'slug' => $this->uniqueSlug($data['name']),
            'name' => $data['name'],
            'icon' => $data['icon'] ?? 'Shield',
            'short' => $data['short'] ?? '',
            'stances' => $this->cleanStances($data['stances'] ?? []),
            'factoid' => $data['factoid'] ?? '',
            'center' => $this->positionsFromInput($data['center'] ?? []),
            'ranges' => $this->rangesFromInput($data['ranges'] ?? []),
            'enabled' => (bool) ($data['enabled'] ?? true),
            'sort_order' => (int) ($data['sort_order'] ?? ((int) CompassPersona::max('sort_order')) + 1),
        ]);

        return response()->json(['success' => true, 'persona' => $persona->toAdminPayload()]);
    }

    public function updatePersona(Request $request, $id)
    {
        $persona = CompassPersona::findOrFail($id);
        $data = $request->validate($this->personaRules());

        // `slug` is deliberately immutable: it is written onto stored results.
        $persona->update([
            'name' => $data['name'],
            'icon' => $data['icon'] ?? 'Shield',
            'short' => $data['short'] ?? '',
            'stances' => $this->cleanStances($data['stances'] ?? []),
            'factoid' => $data['factoid'] ?? '',
            'center' => $this->positionsFromInput($data['center'] ?? []),
            'ranges' => $this->rangesFromInput($data['ranges'] ?? []),
            'enabled' => (bool) ($data['enabled'] ?? $persona->enabled),
            'sort_order' => (int) ($data['sort_order'] ?? $persona->sort_order),
        ]);

        return response()->json(['success' => true, 'persona' => $persona->fresh()->toAdminPayload()]);
    }

    public function destroyPersona($id)
    {
        CompassPersona::findOrFail($id)->delete();

        return response()->json(['success' => true]);
    }

    public function togglePersona($id)
    {
        $persona = CompassPersona::findOrFail($id);
        $persona->update(['enabled' => ! $persona->enabled]);

        return response()->json(['success' => true, 'enabled' => $persona->enabled]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allPersonas(): array
    {
        return CompassPersona::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map->toAdminPayload()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function personaRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:64'],
            'short' => ['nullable', 'string', 'max:600'],
            'factoid' => ['nullable', 'string', 'max:4000'],
            'stances' => ['nullable', 'array', 'max:12'],
            'stances.*' => ['nullable', 'string', 'max:120'],
            'enabled' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'center' => ['present', 'array'],
            'center.*' => ['nullable', 'numeric', 'min:-1', 'max:1'],
            'ranges' => ['nullable', 'array'],
            'ranges.*' => ['nullable', 'array:min,max'],
            'ranges.*.min' => ['nullable', 'numeric', 'min:-1', 'max:1'],
            'ranges.*.max' => ['nullable', 'numeric', 'min:-1', 'max:1'],
        ];
    }

    /**
     * Persona axis windows. A blank row (both bounds empty) is dropped so the
     * persona is unrestricted on that axis.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, array{min: float, max: float}>
     */
    private function rangesFromInput(array $input): array
    {
        $ranges = [];
        foreach (CompassStats::AXIS_IDS as $axis) {
            $row = $input[$axis] ?? null;
            if (! is_array($row)) {
                continue;
            }
            $min = ($row['min'] ?? '') === '' ? null : $row['min'] ?? null;
            $max = ($row['max'] ?? '') === '' ? null : $row['max'] ?? null;
            if ($min === null && $max === null) {
                continue;
            }
            $ranges[$axis] = [
                'min' => round((float) ($min ?? -1), 4),
                'max' => round((float) ($max ?? 1), 4),
            ];
        }

        return $ranges;
    }

    /** @param  array<int, mixed>  $stances */
    private function cleanStances(array $stances): array
    {
        return array_values(array_filter(
            array_map(fn ($s) => is_string($s) ? trim($s) : '', $stances),
            fn (string $s) => $s !== '',
        ));
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'persona';
        $slug = $base;
        $i = 2;
        while (CompassPersona::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    /**
     * @return array<string, mixed>
     */
    private function stats(): array
    {
        $base = fn () => CompassResult::query()
            ->whereNull('user_id')
            ->where('stats_consent', true);

        // Shared with the public page: totals, per-scope axis averages, persona
        // distribution and per-question answer counts.
        $core = CompassStats::aggregateAnonymous();

        $avg = $base()
            ->selectRaw('avg(consistency) as consistency, avg(answered) as answered')
            ->first();

        return array_merge($core, [
            'last7' => $base()->where('created_at', '>=', now()->subDays(7))->count(),
            'last30' => $base()->where('created_at', '>=', now()->subDays(30))->count(),
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
        ]);
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
