<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    Schema::create('songs', function (Blueprint $table) {
      $table->id();
      $table->string('title');
      $table->string('artist')->nullable();
      $table->string('slug')->unique();
      $table->string('status')->default('processing')->index(); // processing|ready|failed
      $table->unsignedInteger('duration_seconds')->nullable();
      $table->string('audio_path')->nullable(); // R2 key: spotify/songs/{id}/{uuid}.mp3
      $table->string('cover_path')->nullable(); // R2 key: spotify/covers/{id}/{uuid}.webp
      $table->longText('lyrics_lrc')->nullable();
      $table->string('lyrics_status')->default('none'); // none|pending|ready|failed
      $table->text('error')->nullable();
      // internal, never serialized: the original upload stays on the local disk
      // for failed songs so the admin retry endpoint can reprocess it
      $table->string('temp_path')->nullable();
      $table->timestamps();
    });

    Schema::create('playlists', function (Blueprint $table) {
      $table->id();
      $table->string('name');
      $table->string('slug')->unique();
      $table->string('edit_token', 64);
      $table->timestamps();
    });

    Schema::create('playlist_song', function (Blueprint $table) {
      $table->id();
      $table->foreignId('playlist_id')->constrained()->cascadeOnDelete();
      $table->foreignId('song_id')->constrained()->cascadeOnDelete();
      $table->unsignedInteger('position');
      $table->unique(['playlist_id', 'song_id']);
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('playlist_song');
    Schema::dropIfExists('playlists');
    Schema::dropIfExists('songs');
  }
};
