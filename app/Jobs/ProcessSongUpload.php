<?php

namespace App\Jobs;

use App\Models\Song;
use App\Services\AudioMetadataService;
use App\Services\GeminiLyricsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProcessSongUpload implements ShouldQueue
{
  use Queueable;

  public int $timeout = 120;

  // the job records its own failure state on the song row; no blind retries of a big upload
  public int $tries = 1;

  public function __construct(public int $songId, public string $tempPath)
  {
  }

  public function handle(AudioMetadataService $metadata, GeminiLyricsService $gemini): void
  {
    $local = Storage::disk('local');
    $song = Song::find($this->songId);

    if (!$song) {
      $local->delete($this->tempPath);
      return;
    }

    $media = Storage::disk(config('filesystems.media_disk'));
    $written = [];

    try {
      $meta = $metadata->analyze($local->path($this->tempPath));

      $dir = "spotify/songs/{$song->id}";
      $name = Str::uuid() . '.mp3';
      if ($media->putFileAs($dir, new File($local->path($this->tempPath)), $name, 'public') === false) {
        throw new \RuntimeException("failed writing {$dir}/{$name}");
      }
      $audioPath = "{$dir}/{$name}";
      $written[] = $audioPath;

      $coverPath = null;
      if ($meta['picture']) {
        $webp = $metadata->coverWebp($meta['picture']['data']);
        if ($webp !== null) {
          $coverPath = "spotify/covers/{$song->id}/" . Str::uuid() . '.webp';
          $media->put($coverPath, $webp, 'public');
          $written[] = $coverPath;
        }
      }

      $song->update([
        'status' => 'ready',
        'error' => null,
        'duration_seconds' => $meta['duration_seconds'],
        'title' => Str::limit(filled($song->title) ? $song->title : ($meta['title'] ?? 'بدون عنوان'), 250, ''),
        'artist' => Str::limit($song->artist ?? $meta['artist'] ?? '', 250, '') ?: null,
        'audio_path' => $audioPath,
        'cover_path' => $coverPath,
        'temp_path' => null,
      ]);
    } catch (\Throwable $e) {
      // clean up partial media writes; the temp file is kept on purpose so the
      // admin retry endpoint can re-run this job without a fresh upload
      $media->delete($written);
      Log::error('spotify: song processing failed', ['song_id' => $song->id, 'error' => $e->getMessage()]);
      $song->update(['status' => 'failed', 'error' => Str::limit($e->getMessage(), 500)]);

      return;
    }

    // past the point of no return: a transient failure here must not tear down
    // a fully processed song, so these stay outside the try
    $local->delete($this->tempPath);

    if (blank($song->lyrics_lrc) && $gemini->enabled()) {
      $song->update(['lyrics_status' => 'pending']);
      ExtractSongLyrics::dispatch($song->id);
    }
  }

  // worker-kill path (timeout, OOM, deploy restart): the catch above never ran
  public function failed(?\Throwable $e): void
  {
    Song::where('id', $this->songId)->where('status', 'processing')
      ->update(['status' => 'failed', 'error' => 'انقطعت المعالجة قبل الاكتمال، أعد المحاولة']);
  }
}
