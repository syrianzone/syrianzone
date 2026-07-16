<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlaceReport extends Model
{
  use HasFactory;

  protected $fillable = ['place_id', 'user_id', 'reason', 'details', 'status'];

  public function place() { return $this->belongsTo(Place::class); }
  // withTrashed: reporters may soft-delete their account, the admin tab must keep resolving
  public function user() { return $this->belongsTo(User::class)->withTrashed(); }
}
