<?php

namespace App\Jobs;

use App\Models\Song;
use App\Services\GeminiLyricsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ExtractSongLyrics implements ShouldQueue
{
  use Queueable;

  public int $timeout = 280;

  public int $tries = 1;

  public function __construct(public int $songId)
  {
  }

  public function handle(GeminiLyricsService $gemini): void
  {
    $song = Song::find($this->songId);
    if (!$song || !$song->audio_path) {
      return;
    }

    try {
      $bytes = Storage::disk(config('filesystems.media_disk'))->get($song->audio_path);
      $lrc = $bytes === null ? null : $gemini->extractLrc($bytes);
    } catch (\Throwable $e) {
      Log::warning('spotify: lyrics extraction failed', ['song_id' => $song->id, 'error' => $e->getMessage()]);
      $lrc = null;
    }

    if ($lrc === null) {
      $song->update(['lyrics_status' => 'failed']);
      return;
    }

    $song->update(['lyrics_lrc' => $lrc, 'lyrics_status' => 'ready']);
  }

  // runs when the worker kills the job (timeout, OOM, deploy restart): the
  // in-handle catch never fires there, and a stuck 'pending' polls forever
  public function failed(?\Throwable $e): void
  {
    Song::where('id', $this->songId)->where('lyrics_status', 'pending')->update(['lyrics_status' => 'failed']);
  }
}
