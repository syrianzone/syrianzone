<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('stops') || Schema::hasColumn('stops', 'name_en')) {
            return;
        }

        Schema::table('stops', function (Blueprint $table): void {
            $table->string('name_en')->nullable()->after('name_ar');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('stops') || ! Schema::hasColumn('stops', 'name_en')) {
            return;
        }

        Schema::table('stops', function (Blueprint $table): void {
            $table->dropColumn('name_en');
        });
    }
};
