<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuranBookmark extends Model
{
  use HasFactory;

  protected $fillable = ['user_id', 'surah', 'ayah', 'page', 'juz'];

  protected function casts(): array
  {
    return [
      'surah' => 'integer',
      'ayah' => 'integer',
      'page' => 'integer',
      'juz' => 'integer',
    ];
  }

  public function user()
  {
    return $this->belongsTo(User::class);
  }
}
