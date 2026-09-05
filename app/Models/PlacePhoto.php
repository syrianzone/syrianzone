<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class PlacePhoto extends Model
{
  use HasFactory;

  protected $fillable = ['place_id', 'original_path', 'display_path', 'thumb_path', 'sort'];

  public function place() { return $this->belongsTo(Place::class); }

  // /storage is served with a year-long immutable cache, so URLs must change when
  // pixels change: reprocess()/rotateClockwise() touch the row and the version
  // comes from updated_at (?v=). This differs from AvatarService's fresh-UUID
  // strategy on purpose: avatar_url is embedded in auth responses and cached
  // client-side without a version param, so only a never-seen path busts;
  // place thumbs always render via these versioned accessors, so ?v= suffices
  // and keeps paths stable. replace() still mints fresh paths (new entity).
  public function getThumbUrlAttribute(): string { return $this->versionedUrl($this->thumb_path); }
  public function getDisplayUrlAttribute(): string { return $this->versionedUrl($this->display_path); }

  private function versionedUrl(string $path): string
  {
    return Storage::disk(config('filesystems.media_disk'))->url($path) . '?v=' . ($this->updated_at?->getTimestamp() ?? 0);
  }
}
