<?php

namespace App\Console\Commands;

use App\Models\Contributor;
use Illuminate\Console\Command;

class MigrateContributors extends Command
{
    protected $signature = 'migrate:legacy-contributors';
    protected $description = 'Import contributors from legacy JSON file';

    public function handle()
    {
        $jsonPath = base_path('../syrian-contributors/public/contributors.json');

        if (!file_exists($jsonPath)) {
            return $this->error("File not found: $jsonPath");
        }

        $data = json_decode(file_get_contents($jsonPath), true);

        if (!$data) {
            return $this->error("Failed to decode JSON");
        }

        $this->info("Found " . count($data) . " contributors. Importing...");
        $bar = $this->output->createProgressBar(count($data));

        foreach ($data as $item) {
            Contributor::updateOrCreate(
                ['name' => $item['username']],
                [
                    'total_contributions' => $item['total_contributions'] ?? 0,
                    'avatar_url' => $item['avatar_url'] ?? null,
                ]
            );
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Import completed successfully.");
    }
}
