<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlaceComment extends Model
{
  use HasFactory;

  protected $fillable = ['place_id', 'user_id', 'body'];

  public function place() { return $this->belongsTo(Place::class); }
  // withTrashed: commenters may soft-delete their account, listings must keep resolving
  public function user() { return $this->belongsTo(User::class)->withTrashed(); }
}
