<?php

namespace App\Services;

use App\Models\GuessWhoGame;
use App\Models\MobileGuessWhoSession;
use Illuminate\Support\Facades\DB;

class GuessWhoSessionPruner
{
    public function pruneExpired(): array
    {
        return DB::transaction(function (): array {
            $expired = MobileGuessWhoSession::query()
                ->where('expires_at', '<=', now())
                ->lockForUpdate()
                ->get(['id', 'room_code']);
            $roomCodes = $expired->pluck('room_code')->filter()->unique()->values();
            $sessionIds = $expired->pluck('id');

            if ($roomCodes->isNotEmpty()) {
                $sessionIds = $sessionIds
                    ->merge(
                        MobileGuessWhoSession::query()
                            ->whereIn('room_code', $roomCodes)
                            ->pluck('id'),
                    )
                    ->unique();
            }

            $rooms = $roomCodes->isEmpty()
              ? 0
              : GuessWhoGame::query()->whereIn('room_code', $roomCodes)->delete();
            $sessions = $sessionIds->isEmpty()
              ? 0
              : MobileGuessWhoSession::query()->whereKey($sessionIds)->delete();

            return ['rooms' => $rooms, 'sessions' => $sessions];
        });
    }
}
