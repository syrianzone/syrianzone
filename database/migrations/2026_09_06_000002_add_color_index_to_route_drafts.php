<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('route_drafts', function (Blueprint $table) {
            $table->integer('color_index')->nullable()->after('price');
        });
    }

    public function down(): void
    {
        Schema::table('route_drafts', function (Blueprint $table) {
            $table->dropColumn('color_index');
        });
    }
};
