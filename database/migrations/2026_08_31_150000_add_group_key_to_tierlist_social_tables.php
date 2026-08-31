<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tierlist_social_states', function (Blueprint $table) {
            $table->string('group_key', 32)->default('')->after('poll_id');
        });
        Schema::table('tierlist_social_states', function (Blueprint $table) {
            $table->unique(['poll_id', 'group_key']);
        });
        Schema::table('tierlist_social_states', function (Blueprint $table) {
            $table->dropUnique('tierlist_social_states_poll_id_unique');
        });

        Schema::table('tierlist_social_posts', function (Blueprint $table) {
            $table->string('group_key', 32)->nullable()->after('poll_id');
        });

        // Existing rows hold the combined all-groups snapshot; per-group
        // detection rebaselines silently on its first run (FR-003).
        DB::table('tierlist_social_states')->delete();
    }

    public function down(): void
    {
        DB::table('tierlist_social_states')->delete();

        Schema::table('tierlist_social_states', function (Blueprint $table) {
            $table->unique('poll_id');
        });
        Schema::table('tierlist_social_states', function (Blueprint $table) {
            $table->dropUnique(['poll_id', 'group_key']);
        });
        Schema::table('tierlist_social_states', function (Blueprint $table) {
            $table->dropColumn('group_key');
        });

        Schema::table('tierlist_social_posts', function (Blueprint $table) {
            $table->dropColumn('group_key');
        });
    }
};
