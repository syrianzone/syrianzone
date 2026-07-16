<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Place extends Model
{
  use HasFactory;

  protected $fillable = ['user_id', 'name', 'category', 'description', 'lat', 'lng', 'status', 'rejection_reason', 'approved_at'];

  protected $casts = ['lat' => 'float', 'lng' => 'float', 'approved_at' => 'datetime'];

  // withTrashed: authors may soft-delete their account, content must keep resolving
  public function user() { return $this->belongsTo(User::class)->withTrashed(); }
  public function photos() { return $this->hasMany(PlacePhoto::class)->orderBy('sort'); }
  public function saves() { return $this->hasMany(PlaceSave::class); }
}
