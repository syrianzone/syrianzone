<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('guess_who_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name_ar');
            $table->string('name_en');
            $table->string('slug')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('guess_who_characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('guess_who_categories')->cascadeOnDelete();
            $table->string('name_ar');
            $table->string('name_en');
            $table->string('image_path');
            $table->json('attributes')->nullable(); // e.g. {"gender": "male", "glasses": true}
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('guess_who_games', function (Blueprint $table) {
            $table->id();
            $table->uuid('room_code')->unique();
            $table->foreignId('category_id')->constrained('guess_who_categories')->cascadeOnDelete();
            $table->string('player_1_session'); // local session UUID
            $table->string('player_2_session')->nullable();
            $table->foreignId('player_1_character_id')->nullable()->constrained('guess_who_characters');
            $table->foreignId('player_2_character_id')->nullable()->constrained('guess_who_characters');
            $table->string('status')->default('lobby'); // lobby, selecting, playing, finished
            $table->string('winner_session')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guess_who_games');
        Schema::dropIfExists('guess_who_characters');
        Schema::dropIfExists('guess_who_categories');
    }
};
