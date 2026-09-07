<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('house_members_2026', function (Blueprint $table) {
            $table->id();
            $table->string('name_ar');
            $table->string('governorate_ar')->nullable();
            $table->string('district')->nullable();
            $table->string('town')->nullable();
            $table->string('gender', 2)->nullable(); // M|F
            $table->integer('birth_year')->nullable();
            $table->integer('age')->nullable();
            $table->string('selection_method')->nullable();
            $table->string('category')->nullable();
            $table->enum('status', ['active', 'resigned', 'dead', 'inactive'])->default('active')->index();
            $table->string('member_number')->nullable()->unique();
            $table->string('management_position')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('house_members_2026');
    }
};
