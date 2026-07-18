<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('media_cleanup_jobs')) {
            return;
        }

        Schema::create('media_cleanup_jobs', function (Blueprint $table): void {
            $table->id();
            $table->string('disk', 64);
            $table->string('path', 400);
            $table->boolean('is_directory')->default(false);
            $table->unsignedInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('available_at')->useCurrent()->index();
            $table->timestamp('claimed_at')->nullable()->index();
            $table->uuid('claim_token')->nullable();
            $table->timestamps();
            $table->unique(['disk', 'path']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_cleanup_jobs');
    }
};
