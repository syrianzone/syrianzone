<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    Schema::dropIfExists('place_comments');
  }

  public function down(): void
  {
    Schema::create('place_comments', function (Blueprint $table) {
      $table->id();
      $table->foreignId('place_id')->constrained()->cascadeOnDelete();
      $table->foreignId('user_id')->constrained()->cascadeOnDelete();
      $table->string('body', 500);
      $table->timestamps();
    });
  }
};
