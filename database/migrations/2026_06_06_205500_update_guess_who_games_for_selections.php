<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('guess_who_games', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->change();
            $table->json('character_ids')->nullable()->after('category_id');
        });
    }

    public function down(): void
    {
        Schema::table('guess_who_games', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable(false)->change();
            $table->dropColumn('character_ids');
        });
    }
};
