<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fake_news_claim_stats', function (Blueprint $table) {
            $table->string('claim_id', 32)->primary();
            $table->unsignedBigInteger('true_count')->default(0);
            $table->unsignedBigInteger('false_count')->default(0);
        });

        Schema::create('fake_news_score_stats', function (Blueprint $table) {
            $table->unsignedTinyInteger('score')->primary();
            $table->unsignedBigInteger('runs_count')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fake_news_score_stats');
        Schema::dropIfExists('fake_news_claim_stats');
    }
};
