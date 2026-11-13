<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('official_categories', function (Blueprint $table) {
            $table->string('id')->primary(); // Category key e.g. 'governorates', 'ministries'
            $table->string('label_ar');
            $table->string('label_en');
            $table->string('icon')->nullable();
            $table->integer('order_column')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('official_categories');
    }
};
