<?php

namespace App\Console\Commands;

use App\Services\Population\SyriaClimateService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class UpdateSyriaClimate extends Command
{
    protected $signature = 'population:update-climate';
    protected $description = 'Update climate and environmental data for all Syrian cities';

    public function handle()
    {
        $this->info('Starting Syria climate data update...');
        $this->info('This may take several minutes as it fetches data for each city...');

        $startTime = now();

        try {
            $service = new SyriaClimateService();
            $service->setOutput($this->output)->updateAllCities();

            Cache::forget('population_env_report');

            $duration = $startTime->diffInSeconds(now());
            $this->info("✓ Climate data updated successfully ({$duration}s)");
            $this->info('Run completed at: ' . now()->toDateTimeString());

            Log::info('Syria climate data update completed', [
                'duration_seconds' => $duration,
                'completed_at' => now(),
            ]);

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $duration = $startTime->diffInSeconds(now());

            $this->error("✗ Climate data update failed: {$e->getMessage()}");
            $this->error("Run failed after {$duration}s");

            Log::error('Syria climate data update failed', [
                'exception' => $e,
                'duration_seconds' => $duration,
                'failed_at' => now(),
            ]);

            return Command::FAILURE;
        }
    }
}
