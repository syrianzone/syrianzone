<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlacePhoto extends Model
{
  use HasFactory;

  protected $fillable = ['place_id', 'original_path', 'display_path', 'thumb_path', 'sort'];

  public function place() { return $this->belongsTo(Place::class); }
}
