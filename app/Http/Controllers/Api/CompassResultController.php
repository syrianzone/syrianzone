<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompassResult;
use Illuminate\Http\Request;

class CompassResultController extends Controller
{
    /** List the current user's saved runs (newest first). */
    public function index(Request $request)
    {
        $results = CompassResult::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn ($r) => $r->toPayload());

        return response()->json(['data' => $results]);
    }

    /** Save a completed run to the account. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'version' => 'required|in:short,standard,full',
            'answers' => 'required|array',
            'scores' => 'required|array',
            'align' => 'required|array',
            'topFigure' => 'nullable|string|max:255',
            'topScore' => 'nullable|numeric|min:0|max:1',
            'spectrum' => 'nullable|string|max:64',
            'consistency' => 'nullable|numeric|min:0|max:1',
            'answered' => 'nullable|integer|min:0|max:500',
            'statsConsent' => 'nullable|boolean',
        ]);

        $result = CompassResult::create([
            'user_id' => $request->user()->id,
            'version' => $data['version'],
            'answers' => $data['answers'],
            'scores' => $data['scores'],
            'align' => $data['align'],
            'top_figure' => $data['topFigure'] ?? null,
            'top_score' => $data['topScore'] ?? null,
            'spectrum' => $data['spectrum'] ?? null,
            'consistency' => $data['consistency'] ?? null,
            'answered' => $data['answered'] ?? count($data['answers']),
            'stats_consent' => $data['statsConsent'] ?? false,
        ]);

        return response()->json(['data' => $result->toPayload()], 201);
    }

    /** Delete one of the user's runs. */
    public function destroy(Request $request, $id)
    {
        $deleted = CompassResult::where('user_id', $request->user()->id)->where('id', $id)->delete();
        return response()->json(['deleted' => (bool) $deleted]);
    }

    /** Delete all of the user's runs. */
    public function destroyAll(Request $request)
    {
        $count = CompassResult::where('user_id', $request->user()->id)->delete();
        return response()->json(['deleted' => $count]);
    }
}
