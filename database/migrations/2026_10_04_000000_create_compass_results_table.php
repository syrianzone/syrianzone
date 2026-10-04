<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    // One row per completed compass run. `answers` holds the raw responses so a
    // run can be resumed / re-scored; `scores`/`align` are the computed vectors
    // (denormalised for fast listing). `share_id` is the account-independent
    // share key: identical version+answers hash to the same key for every user.
    Schema::create('compass_results', function (Blueprint $table) {
      $table->id();
      $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
      $table->string('version', 16);            // short | standard | full
      $table->string('share_id', 40)->nullable();
      $table->json('answers');
      $table->json('scores');
      $table->json('align');
      $table->string('top_figure')->nullable();
      $table->decimal('top_score', 5, 4)->nullable();
      $table->string('spectrum', 64)->nullable();
      $table->decimal('consistency', 5, 4)->nullable();
      $table->unsignedSmallInteger('answered')->default(0);
      $table->timestamps();

      $table->index(['user_id', 'created_at']);
      $table->unique('share_id');              // account-independent share key (nullable = private)
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('compass_results');
  }
};
