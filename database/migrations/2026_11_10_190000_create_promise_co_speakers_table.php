<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promise_co_speakers', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('promise_id')->constrained('promises')->cascadeOnDelete();
            $table->foreignUuid('speaker_id')->constrained('promise_speakers')->cascadeOnDelete();
            $table->string('speaker_title')->nullable();
            $table->unsignedTinyInteger('sort')->default(0);

            $table->unique(['promise_id', 'speaker_id']);
            $table->index('speaker_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promise_co_speakers');
    }
};
