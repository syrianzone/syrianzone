<?php

namespace App\Http\Controllers;

use App\Models\CompassFigure;
use App\Models\CompassPersona;
use App\Models\CompassResult;
use Inertia\Inertia;

class CompassController extends Controller
{
    /** The compass test page. */
    public function index()
    {
        return Inertia::render('Compass/Index', [
            'figures' => $this->enabledFigures(),
            'personas' => $this->enabledPersonas(),
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
}
