<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('guess_who_games', function (Blueprint $table) {
            // Whose turn it is, by session id. Null until both players have
            // chosen a secret; the server owns the turn now (see the migration
            // plan), so out-of-turn moves can be refused.
            $table->string('turn_session')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('guess_who_games', function (Blueprint $table) {
            $table->dropColumn('turn_session');
        });
    }
};
