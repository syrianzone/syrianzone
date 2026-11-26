<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks when a duplicate Mishwar place has been merged into another approved
 * place. Kept as a nullable additive column (with status='rejected') so
 * blue/green zero-downtime deploys stay compatible with the previous release.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('places', function (Blueprint $table) {
            $table->foreignId('merged_into_id')
                ->nullable()
                ->after('approved_at')
                ->constrained('places')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('places', function (Blueprint $table) {
            $table->dropConstrainedForeignId('merged_into_id');
        });
    }
};
