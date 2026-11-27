<?php

use Database\Seeders\GovAppsSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('gov_apps') || ! Schema::hasColumn('gov_apps', 'overview_ar')) {
            return;
        }

        GovAppsSeeder::applyGuides();
    }

    public function down(): void
    {
        // Safe no-op for zero-downtime blue/green deploys: never drop guide
        // content that an overlapping release or editorial edit relies on.
    }
};
