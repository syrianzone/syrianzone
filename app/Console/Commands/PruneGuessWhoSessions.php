<?php

namespace App\Console\Commands;

use App\Services\GuessWhoSessionPruner;
use Illuminate\Console\Command;

class PruneGuessWhoSessions extends Command
{
    protected $signature = 'guess-who:prune-expired-sessions';

    protected $description = 'Delete expired mobile Guess Who credentials and room state';

    public function handle(GuessWhoSessionPruner $pruner): int
    {
        $counts = $pruner->pruneExpired();

        $this->info(sprintf(
            'Pruned %d expired room%s and %d session%s.',
            $counts['rooms'],
            $counts['rooms'] === 1 ? '' : 's',
            $counts['sessions'],
            $counts['sessions'] === 1 ? '' : 's',
        ));

        return self::SUCCESS;
    }
}
