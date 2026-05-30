<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('candidate_groups', 'is_default')) {
            Schema::table('candidate_groups', function (Blueprint $table) {
                $table->boolean('is_default')->default(false)->after('sort_order');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('candidate_groups', 'is_default')) {
            Schema::table('candidate_groups', function (Blueprint $table) {
                $table->dropColumn('is_default');
            });
        }
    }
};
