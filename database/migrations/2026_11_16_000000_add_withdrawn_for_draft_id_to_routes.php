<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which pending edit took a live route off the map.
 *
 * A transit editor's edit withdraws the route it targets until the edit is
 * reviewed; rejecting or withdrawing that edit puts the route back. Without a
 * record of which draft caused the withdrawal, ending the review of any other
 * suggestion for the same route could republish it while the edit that
 * withdrew it was still pending. Restoration now requires this column to name
 * the draft whose review ended; any other status change clears it.
 *
 * Additive and nullable, so the previous release keeps working during a
 * blue/green switch (ADR-0003).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->unsignedBigInteger('withdrawn_for_draft_id')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropColumn('withdrawn_for_draft_id');
        });
    }
};
