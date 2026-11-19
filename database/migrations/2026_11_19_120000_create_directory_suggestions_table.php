<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('directory_suggestions', function (Blueprint $table) {
            $table->id();
            $table->string('module', 32)->index();
            $table->string('kind', 16)->index(); // add | edit
            $table->string('target_id', 128)->nullable()->index();
            $table->string('target_label', 255)->nullable();
            $table->string('title', 200);
            $table->json('payload')->nullable();
            $table->text('details');
            $table->string('source_url', 2048)->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 16)->default('pending')->index(); // pending | accepted | dismissed
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('resolution_note')->nullable();
            $table->timestamps();

            $table->index(['module', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('directory_suggestions');
    }
};
