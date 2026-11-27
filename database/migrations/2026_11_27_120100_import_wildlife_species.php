<?php

use App\Services\Wildlife\WildlifeImporter;
use Illuminate\Database\Migrations\Migration;

/**
 * Loads the species in resources/data/wildlife.json into the new table, once.
 * From then on the table is the source of truth and the file is the seed a
 * fresh database starts from (`php artisan wildlife:export` refreshes it).
 */
return new class extends Migration
{
    public function up(): void
    {
        app(WildlifeImporter::class)->importIfEmpty();
    }

    public function down(): void
    {
        // Keeps whatever was edited after the import.
    }
};
