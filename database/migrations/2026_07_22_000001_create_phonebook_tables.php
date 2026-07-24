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
        Schema::create('phonebook_categories', function (Blueprint $table) {
            $table->string('id', 64)->primary(); // e.g., emergency, governorates, embassies, services
            $table->string('label_ar');
            $table->string('label_en');
            $table->string('icon', 64)->nullable();
            $table->integer('order_column')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('phonebook_entries', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('category_id', 64);
            $table->foreign('category_id')->references('id')->on('phonebook_categories')->onDelete('cascade');
            $table->string('name_ar');
            $table->string('name_en')->nullable();
            $table->string('number');
            $table->boolean('is_whatsapp')->default(false);
            $table->string('source_url')->nullable();
            $table->integer('order_column')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('phonebook_entries');
        Schema::dropIfExists('phonebook_categories');
    }
};
