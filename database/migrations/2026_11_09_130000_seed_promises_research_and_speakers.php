<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

/**
 * Automatically import the initial researched promises dataset and sync known
 * Tierlist/Official speakers on deploy. Skipped during unit/feature tests so
 * RefreshDatabase starts with a clean `promises` table.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        Artisan::call('promises:import-research');
    }

    public function down(): void
    {
        // Preserves any editorial changes made after import.
    }
};
