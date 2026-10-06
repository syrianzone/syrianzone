<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompassResult;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CompassStatsController extends Controller
{
    /** Anonymous stats submission: store a run detached from any account.
     *  Both logged-in and logged-out users may call this; consent is explicit. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'version' => 'required|in:short,standard,full',
            'answers' => 'required|array',
            'scores' => 'nullable|array',
            'align' => 'nullable|array',
            'topFigure' => 'nullable|string|max:255',
            'topScore' => 'nullable|numeric|min:0|max:1',
            'spectrum' => 'nullable|string|max:64',
            'consistency' => 'nullable|numeric|min:0|max:1',
            'answered' => 'nullable|integer|min:0|max:500',
        ]);

        $row = CompassResult::create([
            'user_id' => null,                 // anonymous by construction
            'version' => $data['version'],
            'answers' => $data['answers'],
            'scores' => $data['scores'] ?? [],
            'align' => $data['align'] ?? [],
            'top_figure' => $data['topFigure'] ?? null,
            'top_score' => $data['topScore'] ?? null,
            'spectrum' => $data['spectrum'] ?? null,
            'consistency' => $data['consistency'] ?? null,
            'answered' => $data['answered'] ?? count($data['answers']),
            'stats_consent' => true,
        ]);

        // Return an opaque delete token so the client can remove exactly this row
        // if the user opts back out (the client never sees the numeric id).
        Cache::forget(\App\Http\Controllers\CompassController::PUBLIC_STATS_CACHE_KEY);

        return response()->json(['ok' => true, 'token' => $this->tokenFor($row)]);
    }

    /** Remove a previously-submitted anonymous row via its token. */
    public function destroy(Request $request)
    {
        $data = $request->validate(['token' => 'required|string|max:128']);
        $id = $this->idFromToken($data['token']);
        if ($id) {
            CompassResult::where('id', $id)->whereNull('user_id')->where('stats_consent', true)->delete();
            Cache::forget(\App\Http\Controllers\CompassController::PUBLIC_STATS_CACHE_KEY);
        }
        return response()->json(['ok' => true]);
    }

    private function tokenFor(CompassResult $row): string
    {
        $sig = hash_hmac('sha256', (string) $row->id, (string) config('app.key'));
        return $row->id.'.'.substr($sig, 0, 24);
    }

    private function idFromToken(string $token): ?int
    {
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) return null;
        [$id, $sig] = $parts;
        $expect = substr(hash_hmac('sha256', $id, (string) config('app.key')), 0, 24);
        return hash_equals($expect, $sig) ? (int) $id : null;
    }
}
