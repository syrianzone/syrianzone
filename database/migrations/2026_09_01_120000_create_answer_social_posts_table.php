<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('answer_social_posts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // Apache Answer ids are numeric strings up to 20 digits; 32 leaves headroom.
            $table->string('answer_id', 32)->unique();
            $table->string('question_id', 32);
            $table->string('title');
            $table->string('url');
            $table->text('caption');
            $table->string('status', 16)->default('sending')->index();
            $table->string('x_post_id')->nullable()->unique();
            $table->text('last_error')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('answer_social_posts');
    }
};
