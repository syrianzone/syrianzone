<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Brings place reports back (dropped in 2026_07_16_200003). Google Play's
 * user-generated-content policy requires an in-app way to flag content, and
 * the mobile app shares this endpoint with the web.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('place_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('place_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reason', 32);
            $table->text('details')->nullable();
            // open | resolved | dismissed
            $table->string('status', 16)->default('open');
            $table->timestamps();
            $table->unique(['place_id', 'user_id']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('place_reports');
    }
};
