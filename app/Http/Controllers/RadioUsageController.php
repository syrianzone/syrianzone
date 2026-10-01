<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Quran radio data-usage accounting.
 *
 * The client cannot read how many bytes a media element pulled (these
 * responses do not opt into timing), so it sends a *delta* of listening time
 * and the byte count that time implies. Deltas rather than totals, because the
 * counter is per user across devices: two phones listening at once must both
 * count, which last-write-wins on a total cannot do.
 */
class RadioUsageController extends Controller
{
    private const BYTES_KEY = 'quranRadioBytes';
    private const SECONDS_KEY = 'quranRadioSeconds';

    /** Add a listening delta to the user's running totals. */
    public function add(Request $request): JsonResponse
    {
        if (! $user = $request->user()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate([
            'seconds' => 'required|integer|min:0|max:86400',
            'bytes' => 'required|integer|min:0|max:2147483647',
        ]);

        $deltaSeconds = (int) $validated['seconds'];
        $deltaBytes = (int) $validated['bytes'];

        $totals = DB::transaction(function () use ($user, $deltaSeconds, $deltaBytes) {
            // Locked so two devices reporting at once cannot lose an increment.
            $locked = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $settings = $locked->settings ?? [];

            $seconds = max(0, (int) ($settings[self::SECONDS_KEY] ?? 0)) + $deltaSeconds;
            $bytes = max(0, (int) ($settings[self::BYTES_KEY] ?? 0)) + $deltaBytes;

            $settings[self::SECONDS_KEY] = $seconds;
            $settings[self::BYTES_KEY] = $bytes;
            $locked->settings = $settings;
            $locked->save();

            return ['bytes' => $bytes, 'seconds' => $seconds];
        });

        return response()->json(['status' => 'ok', 'totals' => $totals]);
    }

    /** Zero the user's totals. The client clears its own counters alongside. */
    public function clear(Request $request): JsonResponse
    {
        if (! $user = $request->user()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $settings = $user->settings ?? [];
        $settings[self::BYTES_KEY] = 0;
        $settings[self::SECONDS_KEY] = 0;
        $user->settings = $settings;
        $user->save();

        return response()->json([
            'status' => 'ok',
            'totals' => ['bytes' => 0, 'seconds' => 0],
        ]);
    }
}
