<?php

namespace App\Console\Commands;

use App\Services\MediaCleanupService;
use Illuminate\Console\Command;

class CleanupMedia extends Command
{
    protected $signature = 'media:cleanup {--limit=100 : Maximum cleanup jobs to process}';

    protected $description = 'Retry deletion of media objects recorded in the cleanup outbox';

    public function handle(MediaCleanupService $cleanup): int
    {
        $result = $cleanup->retryPending((int) $this->option('limit'));
        $this->info("processed {$result['processed']}, deleted {$result['deleted']}, failed {$result['failed']}");

        return $result['failed'] === 0 ? self::SUCCESS : self::FAILURE;
    }
}
