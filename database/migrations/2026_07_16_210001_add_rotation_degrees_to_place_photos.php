<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('place_photos', 'rotation_degrees')) {
            Schema::table('place_photos', function (Blueprint $table): void {
                $table->unsignedSmallInteger('rotation_degrees')->default(0)->after('sort');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('place_photos', 'rotation_degrees')) {
            Schema::table('place_photos', function (Blueprint $table): void {
                $table->dropColumn('rotation_degrees');
            });
        }
    }
};
