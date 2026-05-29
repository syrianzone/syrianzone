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
        Schema::create('routes', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('city_id');
            $table->string('name_ar');
            $table->string('name_en')->nullable();
            $table->integer('color_index')->default(0);
            $table->integer('price_old')->nullable();
            $table->integer('price_new')->nullable();
            $table->enum('status', ['draft', 'published'])->default('published');
            $table->timestamps();

            $table->foreign('city_id')->references('id')->on('cities')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('routes');
    }
};
