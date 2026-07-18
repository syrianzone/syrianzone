<?php

namespace App\Console\Commands;

use App\Models\Ballot;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PrunePollPrivateData extends Command
{
    protected $signature = 'polls:prune-private-data
    {--days= : Override the configured retention period}';

    protected $description = 'Remove expired poll installation, network, and client identifiers';

    public function handle(): int
    {
        $days = $this->option('days');
        $retentionDays = max(
            1,
            $days === null
              ? (int) config('mobile-polls.private_data_retention_days', 30)
              : (int) $days,
        );
        $cutoff = now()->subDays($retentionDays);

        $ballots = Ballot::query()
            ->where('created_at', '<', $cutoff)
            ->where(function ($query): void {
                $query->where('voter_key', '!=', 'pruned')
                    ->orWhereNotNull('ip_hash')
                    ->orWhereNotNull('user_agent');
            })
            ->update([
                'ip_hash' => null,
                'user_agent' => null,
                'voter_key' => 'pruned',
            ]);

        $receipts = DB::table('mobile_poll_vote_receipts')
            ->where('created_at', '<', $cutoff)
            ->delete();

        $this->info(sprintf(
            'Pruned %d ballot identifier set%s and deleted %d receipt%s.',
            $ballots,
            $ballots === 1 ? '' : 's',
            $receipts,
            $receipts === 1 ? '' : 's',
        ));

        return self::SUCCESS;
    }
}
