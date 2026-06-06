<?php

namespace App\Http\Controllers;

use App\Events\GuessWhoSignalingEvent;
use Illuminate\Http\Request;

class SignalingController extends Controller
{
    public function signal(Request $request, $roomCode)
    {
        $request->validate([
            'target_session' => 'required|string',
            'sender_session' => 'required|string',
            'type' => 'required|string|in:offer,answer,candidate',
            'data' => 'required'
        ]);

        broadcast(new GuessWhoSignalingEvent(
            $roomCode,
            $request->target_session,
            $request->sender_session,
            $request->type,
            $request->data
        ))->toOthers();

        return response()->json(['status' => 'signal_sent']);
    }
}
