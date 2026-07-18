<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('places', fn (Blueprint $table) => $table->dropColumn(['likes_count', 'comments_count']));
    }

    public function down(): void
    {
        Schema::table('places', function (Blueprint $table) {
            $table->unsignedInteger('likes_count')->default(0)->after('rejection_reason');
            $table->unsignedInteger('comments_count')->default(0)->after('rejection_reason');
        });
    }
};
