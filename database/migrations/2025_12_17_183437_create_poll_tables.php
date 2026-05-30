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
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('daily_ranks');
        Schema::dropIfExists('daily_scores');
        Schema::dropIfExists('ballot_items');
        Schema::dropIfExists('ballots');
        Schema::dropIfExists('candidates');
        Schema::dropIfExists('polls');
        Schema::dropIfExists('poll_tables');
        Schema::dropIfExists('votes');
        Schema::dropIfExists('questions');
        Schema::enableForeignKeyConstraints();

        Schema::create('polls', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 100)->unique();
            $table->string('title', 200);
            $table->string('timezone', 64)->default('Europe/Amsterdam');
            $table->boolean('is_active')->default(true);
            $table->timestamps(); // creates created_at and updated_at
        });

        Schema::create('candidates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('poll_id');
            $table->string('name', 200);
            $table->string('title', 200)->nullable();
            $table->text('image_url')->nullable();
            $table->string('category', 32)->default('minister');
            $table->integer('sort')->default(0);
            $table->timestamps();

            $table->foreign('poll_id')->references('id')->on('polls')->onDelete('cascade');
        });

        Schema::create('ballots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('poll_id');
            $table->timestamp('vote_day');
            $table->string('voter_key', 128);
            $table->string('ip_hash', 128)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();

            $table->foreign('poll_id')->references('id')->on('polls')->onDelete('cascade');
        });

        Schema::create('ballot_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('ballot_id');
            $table->uuid('candidate_id');
            $table->string('tier', 1); // S|A|B|C|D|F
            $table->integer('position')->default(0);

            $table->foreign('ballot_id')->references('id')->on('ballots')->onDelete('cascade');
            $table->foreign('candidate_id')->references('id')->on('candidates')->onDelete('cascade');
        });

        Schema::create('daily_scores', function (Blueprint $table) {
            $table->uuid('poll_id');
            $table->uuid('candidate_id');
            $table->timestamp('day');
            $table->integer('votes')->default(0);
            $table->integer('score')->default(0);
            $table->timestamp('updated_at')->useCurrent();

            $table->primary(['poll_id', 'candidate_id', 'day']);
            $table->foreign('poll_id')->references('id')->on('polls')->onDelete('cascade');
            $table->foreign('candidate_id')->references('id')->on('candidates')->onDelete('cascade');
        });

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

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_ranks');
        Schema::dropIfExists('daily_scores');
        Schema::dropIfExists('ballot_items');
        Schema::dropIfExists('ballots');
        Schema::dropIfExists('candidates');
        Schema::dropIfExists('polls');
    }
};
