<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crossings')) {
            return;
        }

        Schema::create('crossings', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name_ar');
            $table->string('name_en')->nullable();
            $table->string('country')->nullable()->index();
            $table->string('governorate')->nullable()->index();
            $table->string('type', 32)->default('crossing')->index();
            $table->string('status', 32)->default('open')->index();
            $table->string('hours_ar', 500)->nullable();
            $table->text('notes_ar')->nullable();
            $table->string('phone', 64)->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crossings');
    }
};
