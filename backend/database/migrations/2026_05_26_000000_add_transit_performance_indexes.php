<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $isMysql = in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb']);

        Schema::table('stops', function (Blueprint $table) use ($isMysql) {
            if ($isMysql) $table->spatialIndex('geometry');
            $table->index('city_id');
        });

        Schema::table('route_geometries', function (Blueprint $table) use ($isMysql) {
            if ($isMysql) $table->spatialIndex('geometry');
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
        $isMysql = in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb']);

        Schema::table('stops', function (Blueprint $table) use ($isMysql) {
            if ($isMysql) $table->dropSpatialIndex(['geometry']);
            $table->dropIndex(['city_id']);
        });

        Schema::table('route_geometries', function (Blueprint $table) use ($isMysql) {
            if ($isMysql) $table->dropSpatialIndex(['geometry']);
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
