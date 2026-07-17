<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('route_drafts', function (Blueprint $table) {
            $table->string('route_id')->nullable()->after('user_id');
            $table->foreign('route_id')->references('id')->on('routes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('route_drafts', function (Blueprint $table) {
            $table->dropForeign(['route_id']);
            $table->dropColumn('route_id');
        });
    }
};
