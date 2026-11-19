<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

/**
 * Automatically import the researched Government CVs dataset and link known
 * Tierlist/Official/Speaker/House records on deploy. Skipped during unit/feature
 * tests so RefreshDatabase starts with clean govt_cvs tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        if (! is_file(database_path('seeders/data/govtcvs_research.json'))) {
            return;
        }

        $exitCode = Artisan::call('govtcvs:import-research');
        if ($exitCode !== 0) {
            throw new RuntimeException('govtcvs:import-research failed: '.trim(Artisan::output()));
        }
    }

    public function down(): void
    {
        // Preserves any editorial changes made after import.
    }
};
