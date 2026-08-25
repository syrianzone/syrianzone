<?php

namespace App\Models;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Song extends Model
{
  protected $fillable = [
    'title', 'artist', 'slug', 'status', 'duration_seconds',
    'audio_path', 'cover_path', 'lyrics_lrc', 'lyrics_status', 'error', 'temp_path',
  ];

  protected $casts = ['duration_seconds' => 'integer'];

  public static function generateSlug(): string
  {
    do {
      $slug = strtolower(Str::random(10));
    } while (static::where('slug', $slug)->exists());

    return $slug;
  }

  public function audioUrl(): ?string
  {
    return $this->audio_path ? $this->mediaDisk()->url($this->audio_path) : null;
  }

  public function coverUrl(): ?string
  {
    return $this->cover_path ? $this->mediaDisk()->url($this->cover_path) : null;
  }

  /** SongSummary shape shared by public Inertia props and admin JSON. */
  public function toSummaryArray(): array
  {
    return [
      'id' => $this->id,
      'title' => $this->title,
      'artist' => $this->artist,
      'slug' => $this->slug,
      'status' => $this->status,
      'lyrics_status' => $this->lyrics_status,
      'duration_seconds' => $this->duration_seconds,
      'audio_url' => $this->audioUrl(),
      'cover_url' => $this->coverUrl(),
      'has_lyrics' => filled($this->lyrics_lrc),
      'created_at' => $this->created_at?->toISOString(),
    ];
  }

  /** SongFull: summary + lyrics; admin responses additionally carry the error. */
  public function toFullArray(bool $forAdmin = false): array
  {
    $full = $this->toSummaryArray() + ['lyrics_lrc' => $this->lyrics_lrc];

    return $forAdmin ? $full + ['error' => $this->error] : $full;
  }

  private function mediaDisk(): Filesystem
  {
    return Storage::disk(config('filesystems.media_disk'));
  }
}
