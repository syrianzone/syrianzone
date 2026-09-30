<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('guess_who_games', function (Blueprint $table) {
            // Each player's eliminated characters, kept server-side so a refresh
            // resumes the board and only the count is shared with the opponent.
            $table->json('player_1_eliminated')->nullable()->after('player_2_character_id');
            $table->json('player_2_eliminated')->nullable()->after('player_1_eliminated');
        });
    }

    public function down(): void
    {
        Schema::table('guess_who_games', function (Blueprint $table) {
            $table->dropColumn(['player_1_eliminated', 'player_2_eliminated']);
        });
    }
};
