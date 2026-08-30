<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tierlist_social_states', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poll_id')->unique()->constrained()->cascadeOnDelete();
            $table->char('observed_hash', 64);
            $table->json('observed_snapshot');
            $table->timestamp('observed_at');
            $table->char('published_hash', 64);
            $table->json('published_snapshot');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('tierlist_social_posts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poll_id')->constrained()->cascadeOnDelete();
            $table->char('transition_hash', 64)->unique();
            $table->char('before_hash', 64);
            $table->char('after_hash', 64);
            $table->json('before_snapshot');
            $table->json('after_snapshot');
            $table->text('text');
            $table->string('status', 32)->default('pending')->index();
            $table->unsignedInteger('attempts')->default(0);
            $table->unsignedSmallInteger('last_http_status')->nullable();
            $table->string('last_error', 255)->nullable();
            $table->string('x_post_id', 64)->nullable()->unique();
            $table->timestamp('attempted_at')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tierlist_social_posts');
        Schema::dropIfExists('tierlist_social_states');
    }
};
