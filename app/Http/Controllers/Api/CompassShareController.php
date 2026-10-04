<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompassResult;
use Illuminate\Http\Request;

class CompassShareController extends Controller
{
    /** Create (or return) an account-independent share key for a result.
     *  Identical version + answers always hash to the same key, so different
     *  users with the same result get the exact same share link. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'version' => 'required|in:short,standard,full',
            'answers' => 'required|array',
        ]);

        // Canonicalise: sort keys so answer order never changes the hash.
        $answers = $data['answers'];
        ksort($answers);
        $shareId = substr(hash('sha256', $data['version'].'|'.json_encode($answers)), 0, 32);

        // Idempotent: return existing share row if present, else create one
        // detached from any account (user_id = null).
        $existing = CompassResult::where('share_id', $shareId)->first();
        if (! $existing) {
            CompassResult::create([
                'user_id' => null,
                'version' => $data['version'],
                'share_id' => $shareId,
                'answers' => $answers,
                'scores' => [],
                'align' => [],
                'answered' => count($answers),
            ]);
        }

        return response()->json(['share_id' => $shareId]);
    }

    /** Public read of a shared result by key. */
    public function show($shareId)
    {
        $row = CompassResult::where('share_id', $shareId)->first();
        if (! $row) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json(['data' => [
            'version' => $row->version,
            'answers' => $row->answers,
        ]]);
    }
}
