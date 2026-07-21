<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Board extends Model
{
  use HasFactory;

  protected $fillable = ['user_id', 'version', 'document'];

  protected $casts = ['document' => 'array'];

  public function user() { return $this->belongsTo(User::class); }
}
