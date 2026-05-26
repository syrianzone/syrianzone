<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stops', function (Blueprint $table) {
            $table->spatialIndex('geometry');
            $table->index('city_id');
        });

        Schema::table('route_geometries', function (Blueprint $table) {
            $table->spatialIndex('geometry');
        });

        Schema::table('routes', function (Blueprint $table) {
            $table->index(['city_id', 'status']);
        });

        Schema::table('route_stop', function (Blueprint $table) {
            $table->index('stop_id');
            $table->index('route_id');
        });
    }

    public function down(): void
    {
        Schema::table('stops', function (Blueprint $table) {
            $table->dropSpatialIndex(['geometry']);
            $table->dropIndex(['city_id']);
        });

        Schema::table('route_geometries', function (Blueprint $table) {
            $table->dropSpatialIndex(['geometry']);
        });

        Schema::table('routes', function (Blueprint $table) {
            $table->dropIndex(['city_id', 'status']);
        });

        Schema::table('route_stop', function (Blueprint $table) {
            $table->dropIndex(['stop_id']);
            $table->dropIndex(['route_id']);
        });
    }
};
