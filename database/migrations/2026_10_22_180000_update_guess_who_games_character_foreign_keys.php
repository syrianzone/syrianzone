<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('guess_who_games', function (Blueprint $table) {
            $table->dropForeign(['player_1_character_id']);
            $table->dropForeign(['player_2_character_id']);

            $table->foreign('player_1_character_id')
                ->references('id')
                ->on('guess_who_characters')
                ->nullOnDelete();

            $table->foreign('player_2_character_id')
                ->references('id')
                ->on('guess_who_characters')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('guess_who_games', function (Blueprint $table) {
            $table->dropForeign(['player_1_character_id']);
            $table->dropForeign(['player_2_character_id']);

            $table->foreign('player_1_character_id')
                ->references('id')
                ->on('guess_who_characters');

            $table->foreign('player_2_character_id')
                ->references('id')
                ->on('guess_who_characters');
        });
    }
};
