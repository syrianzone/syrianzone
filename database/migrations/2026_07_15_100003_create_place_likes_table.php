<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    Schema::create('place_likes', function (Blueprint $table) {
      $table->id();
      $table->foreignId('place_id')->constrained()->cascadeOnDelete();
      $table->foreignId('user_id')->constrained()->cascadeOnDelete();
      $table->timestamps();
      $table->unique(['place_id', 'user_id']);
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('place_likes');
  }
};
