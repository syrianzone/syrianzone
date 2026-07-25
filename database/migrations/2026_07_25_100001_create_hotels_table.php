<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::create('hotels', function (Blueprint $table) {
      $table->id();
      $table->uuid('hala_syria_id')->unique();
      $table->string('name', 255);
      $table->string('name_ar', 255)->nullable();
      $table->string('city', 100)->index();
      $table->string('city_ar', 100)->nullable();
      $table->string('city_slug', 100);
      $table->string('slug', 255)->unique();
      $table->decimal('lat', 10, 7);
      $table->decimal('lng', 10, 7);
      $table->tinyInteger('star_rating')->nullable();
      $table->decimal('rating', 3, 1)->nullable();
      $table->unsignedInteger('review_count')->default(0);
      $table->decimal('now_show_rate', 10, 2)->nullable();
      $table->string('currency', 5)->default('USD');
      $table->string('address', 500)->nullable();
      $table->string('address_ar', 500)->nullable();
      $table->string('phone', 50)->nullable();
      $table->string('email', 255)->nullable();
      $table->text('description')->nullable();
      $table->text('description_ar')->nullable();
      $table->json('images')->nullable();
      $table->boolean('has_restaurant')->default(false);
      $table->boolean('has_swimming_pool')->default(false);
      $table->boolean('has_spa')->default(false);
      $table->boolean('has_fitness_center')->default(false);
      $table->boolean('has_parking')->default(false);
      $table->boolean('has_airport_shuttle')->default(false);
      $table->boolean('has_bar')->default(false);
      $table->boolean('has_room_service')->default(false);
      $table->string('source_url', 1000);
      $table->timestamp('last_synced_at')->nullable();
      $table->timestamps();

      $table->index(['lat', 'lng']);
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('hotels');
  }
};
