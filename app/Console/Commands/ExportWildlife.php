<?php

namespace App\Console\Commands;

use App\Services\Wildlife\WildlifeImporter;
use Illuminate\Console\Command;

/**
 * Writes the published species back to resources/data/wildlife.json, the seed
 * a fresh database starts from. Run it after edits made through the agent
 * tools, then commit the file: the diff is a reviewable record of what changed,
 * and scripts/wildlife/verify.py checks the file.
 */
class ExportWildlife extends Command
{
    protected $signature = 'wildlife:export {--stdout : Print the file instead of writing it}';

    protected $description = 'Write the published wildlife species to resources/data/wildlife.json';

    public function handle(WildlifeImporter $importer): int
    {
        $json = $importer->exportJson();

        if ($this->option('stdout')) {
            $this->output->write($json);

            return self::SUCCESS;
        }

        file_put_contents(resource_path('data/wildlife.json'), $json);
        $this->info('Wrote resources/data/wildlife.json.');

        return self::SUCCESS;
    }
}
