<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class Playlist extends Model
{
  protected $fillable = ['name', 'slug', 'edit_token'];

  protected $hidden = ['edit_token'];

  public static function generateSlug(): string
  {
    do {
      $slug = strtolower(Str::random(10));
    } while (static::where('slug', $slug)->exists());

    return $slug;
  }

  public function songs(): BelongsToMany
  {
    return $this->belongsToMany(Song::class)
      ->withPivot('position')
      ->orderBy('playlist_song.position');
  }
}
