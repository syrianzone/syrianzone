<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('house_members_2026', function (Blueprint $table) {
            $table->string('facebook_url')->nullable()->after('management_position');
            $table->string('twitter_url')->nullable()->after('facebook_url');
        });
    }

    public function down(): void
    {
        Schema::table('house_members_2026', function (Blueprint $table) {
            $table->dropColumn(['facebook_url', 'twitter_url']);
        });
    }
};
