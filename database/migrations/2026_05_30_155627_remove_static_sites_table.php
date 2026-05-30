<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::dropIfExists('static_sites');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('static_sites', function (Blueprint $table) {
            $table->id();
            $table->string('name', 200);
            $table->string('slug', 100)->unique();
            $table->string('path', 255);
            $table->boolean('is_visible')->default(true);
            $table->timestamps();
        });
    }
};
