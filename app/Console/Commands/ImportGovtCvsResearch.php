<?php

namespace App\Console\Commands;

use App\Services\GovtCvs\GovtCvImportService;
use Illuminate\Console\Command;

/**
 * Import researched Government CVs & Tenure Tracker dataset
 * (`database/seeders/data/govtcvs_research.json`).
 */
class ImportGovtCvsResearch extends Command
{
    protected $signature = 'govtcvs:import-research
        {--path= : JSON file path (defaults to database/seeders/data/govtcvs_research.json)}
        {--dry-run : Show what would be imported without writing to the database}';

    protected $description = 'Idempotently import researched government CVs, office slots, tenures, and evidence links';

    public function handle(GovtCvImportService $importer): int
    {
        $path = $this->option('path') ?: database_path('seeders/data/govtcvs_research.json');

        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        if (! is_array($decoded)) {
            $this->error("Invalid JSON in file: {$path}");

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');

        try {
            $result = $importer->import($decoded, $dryRun);
        } catch (\Throwable $e) {
            $this->error('Import failed: '.$e->getMessage());

            return self::FAILURE;
        }

        if ($result['rows'] !== []) {
            $this->table(['#', 'Official', 'Result'], $result['rows']);
        }

        $this->info(sprintf(
            '%s: %d office slots, %d officials, %d tenures, %d CV entries, %d evidence links (%d cross-module links matched).',
            $dryRun ? 'Dry run complete' : 'Import complete',
            $result['slots_imported'],
            $result['officials_imported'],
            $result['tenures_imported'],
            $result['cv_entries_imported'],
            $result['evidence_imported'],
            $result['links_matched'],
        ));

        return self::SUCCESS;
    }
}
