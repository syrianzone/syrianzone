<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    // One bookmarked Ayah per row. Surah/Ayah follow quranic-vocab
    // canonical terms; page/juz are context for jumping back.
    // Mirrors place_saves: unique per user+ayah, cascade on user delete
    // (ayahs are static data).
    Schema::create('quran_bookmarks', function (Blueprint $table) {
      $table->id();
      $table->foreignId('user_id')->constrained()->cascadeOnDelete();
      $table->unsignedTinyInteger('surah');
      $table->unsignedSmallInteger('ayah');
      $table->unsignedSmallInteger('page');
      $table->unsignedTinyInteger('juz');
      $table->timestamps();
      $table->unique(['user_id', 'surah', 'ayah']);
      $table->index(['user_id', 'created_at']);
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('quran_bookmarks');
  }
};
