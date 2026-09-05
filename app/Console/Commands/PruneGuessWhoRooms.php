<?php

namespace App\Console\Commands;

use App\Models\GuessWhoGame;
use Illuminate\Console\Command;

class PruneGuessWhoRooms extends Command
{
    protected $signature = 'guesswho:prune {--days=7 : Delete rooms not updated within N days} {--lobby-hours=24 : Delete never-joined lobbies older than N hours}';

    protected $description = 'Delete stale Guess Who rooms so guess_who_games does not grow unbounded';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $lobbyHours = max(1, (int) $this->option('lobby-hours'));

        $old = GuessWhoGame::where('updated_at', '<', now()->subDays($days))->delete();
        $staleLobbies = GuessWhoGame::where('status', 'lobby')
            ->whereNull('player_2_session')
            ->where('created_at', '<', now()->subHours($lobbyHours))
            ->delete();

        $this->info("Pruned {$old} old rooms + {$staleLobbies} stale lobbies.");

        return self::SUCCESS;
    }
}
