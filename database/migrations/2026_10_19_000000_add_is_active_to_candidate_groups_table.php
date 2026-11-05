<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A category (candidate group) can now be disabled instead of deleted.
 *
 * Disabling keeps the row and its candidates — so history, scores and images
 * survive — while taking the category off the public tierlist and out of the
 * vote path. Deletion stays available and remains the only way to remove data.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('candidate_groups', 'is_active')) {
            Schema::table('candidate_groups', function (Blueprint $table) {
                // Default true so every existing category stays published.
                $table->boolean('is_active')->default(true)->after('is_default')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('candidate_groups', 'is_active')) {
            Schema::table('candidate_groups', function (Blueprint $table) {
                $table->dropIndex(['is_active']);
                $table->dropColumn('is_active');
            });
        }
    }
};
