<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * `daily_ranks` held a per-day snapshot of the leaderboard standings. Nothing
 * reads it: the leaderboard sums `daily_scores`, the DailyRank model was removed,
 * and only the staging seeder ever wrote it. It is dropped rather than carried
 * through every future poll-schema change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('daily_ranks');
    }

    public function down(): void
    {
        Schema::create('daily_ranks', function (Blueprint $table) {
            $table->uuid('poll_id');
            $table->uuid('candidate_id');
            $table->timestamp('day');
            $table->integer('rank');
            $table->integer('votes');
            $table->integer('score');
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['poll_id', 'candidate_id', 'day']);
            $table->foreign('poll_id')->references('id')->on('polls')->onDelete('cascade');
            $table->foreign('candidate_id')->references('id')->on('candidates')->onDelete('cascade');
        });
    }
};
