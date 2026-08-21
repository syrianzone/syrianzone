<?php

namespace App\Http\Controllers;

use App\Events\GuessWhoSignalingEvent;
use App\Models\GuessWhoGame;
use Illuminate\Http\Request;

class SignalingController extends Controller
{
    // Upper bound on the signaling payload (SDP offers/answers and ICE
    // candidates are a few KB at most). Anything larger is abuse.
    private const MAX_PAYLOAD_BYTES = 65536;

    public function signal(Request $request, $roomCode)
    {
        $validated = $request->validate([
            'target_session' => 'required|string',
            'sender_session' => 'required|string',
            'type' => 'required|string|in:offer,answer,candidate',
            'data' => 'required'
        ]);

        // Only room members may signal, only to their opponent: without this
        // check anyone could spray WebRTC payloads into any session while
        // impersonating an arbitrary sender_session.
        $game = GuessWhoGame::where('room_code', $roomCode)->first();
        if (!$game) {
            return response()->json(['error' => 'الغرفة غير موجودة.'], 404);
        }

        $players = [$game->player_1_session, $game->player_2_session];
        if (!in_array($validated['sender_session'], $players, true)) {
            return response()->json(['error' => 'غير مصرح لك بالإشارة في هذه الغرفة.'], 403);
        }

        $opponent = $game->player_1_session === $validated['sender_session']
            ? $game->player_2_session
            : $game->player_1_session;
        if ($validated['target_session'] !== $opponent) {
            return response()->json(['error' => 'الجلسة الهدف غير صالحة.'], 422);
        }

        if (strlen(json_encode($validated['data'])) > self::MAX_PAYLOAD_BYTES) {
            return response()->json(['error' => 'حجم البيانات كبير جداً.'], 413);
        }

        broadcast(new GuessWhoSignalingEvent(
            $roomCode,
            $validated['target_session'],
            $validated['sender_session'],
            $validated['type'],
            $validated['data']
        ))->toOthers();

        return response()->json(['status' => 'signal_sent']);
    }
}
