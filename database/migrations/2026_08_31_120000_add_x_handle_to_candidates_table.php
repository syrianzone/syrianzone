<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            // X username without the @. When the person has no account this
            // holds the official account of the ministry they work in.
            $table->string('x_handle', 16)->nullable()->after('title');
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropColumn('x_handle');
        });
    }
};
