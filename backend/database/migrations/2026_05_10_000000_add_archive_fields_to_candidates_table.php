<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            if (!Schema::hasColumn('candidates', 'status')) {
                $table->enum('status', ['active', 'archived'])->default('active')->after('category');
                $table->index('status');
            }
            if (!Schema::hasColumn('candidates', 'term_started_at')) {
                $table->date('term_started_at')->nullable()->after('status');
            }
            if (!Schema::hasColumn('candidates', 'term_ended_at')) {
                $table->date('term_ended_at')->nullable()->after('term_started_at');
            }
            if (!Schema::hasColumn('candidates', 'archive_reason')) {
                $table->string('archive_reason', 200)->nullable()->after('term_ended_at');
            }
            if (!Schema::hasColumn('candidates', 'successor_id')) {
                $table->uuid('successor_id')->nullable()->after('archive_reason');
                $table->foreign('successor_id')->references('id')->on('candidates')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            if (Schema::hasColumn('candidates', 'successor_id')) {
                $table->dropForeign(['successor_id']);
                $table->dropColumn('successor_id');
            }
            foreach (['archive_reason', 'term_ended_at', 'term_started_at'] as $col) {
                if (Schema::hasColumn('candidates', $col)) {
                    $table->dropColumn($col);
                }
            }
            if (Schema::hasColumn('candidates', 'status')) {
                $table->dropIndex(['status']);
                $table->dropColumn('status');
            }
        });
    }
};
