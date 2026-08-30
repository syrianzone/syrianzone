<?php

namespace App\Console\Commands;

use App\Models\Poll;
use App\Services\TierlistChangeDetector;
use App\Services\TierlistSocialOutbox;
use App\Services\XApiClient;
use Illuminate\Console\Command;

class DetectTierlistRankChanges extends Command
{
    protected $signature = 'tierlist:detect-rank-changes';

    protected $description = 'Detect settled tierlist rank changes and queue an X announcement';

    public function handle(
        TierlistChangeDetector $detector,
        TierlistSocialOutbox $outbox,
        XApiClient $client,
    ): int {
        if (! $client->isConfigured()) {
            $this->line('Tierlist X automation is disabled or incomplete.');

            return self::SUCCESS;
        }

        $poll = Poll::where('slug', config('services.x_tierlist.poll_slug'))->first();
        if (! $poll) {
            report(new \RuntimeException('The configured tierlist poll was not found'));
            $this->error('The configured tierlist poll was not found.');

            return self::FAILURE;
        }

        $post = $detector->detect($poll);
        $relayed = $outbox->relayPending($poll);
        if ($post) {
            $this->line('Prepared one tierlist announcement.');
        } else {
            $this->line('No settled rank change detected.');
        }

        $this->line("Queued {$relayed} pending tierlist announcement(s).");

        return self::SUCCESS;
    }
}
