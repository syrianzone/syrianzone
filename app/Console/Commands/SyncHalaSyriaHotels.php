<?php

namespace App\Console\Commands;

use App\Services\HalaSyriaService;
use Illuminate\Console\Command;

class SyncHalaSyriaHotels extends Command
{
  protected $signature = 'hotels:sync';
  protected $description = 'Sync hotel data from the HalaSyria API into the local database';

  public function handle(HalaSyriaService $service): int
  {
    if (!$service->isConfigured()) {
      $this->error('HALASYRIA_API key is not configured.');
      return self::FAILURE;
    }

    $this->info('Fetching hotels from HalaSyria...');
    $synced = $service->sync();
    $this->info("Synced {$synced} hotels.");

    return self::SUCCESS;
  }
}
