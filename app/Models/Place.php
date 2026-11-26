<?php

namespace App\Models;

use App\Models\Concerns\FoldsSearchColumns;
use App\Services\Places\PlaceUrls;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Place extends Model
{
  use FoldsSearchColumns, HasFactory;

  protected $fillable = ['user_id', 'name', 'category', 'description', 'lat', 'lng', 'status', 'rejection_reason', 'approved_at', 'merged_into_id'];

  protected $casts = ['lat' => 'float', 'lng' => 'float', 'approved_at' => 'datetime', 'merged_into_id' => 'integer'];

  // withTrashed: authors may soft-delete their account, content must keep resolving
  public function user() { return $this->belongsTo(User::class)->withTrashed(); }
  public function photos() { return $this->hasMany(PlacePhoto::class)->orderBy('sort'); }
  public function saves() { return $this->hasMany(PlaceSave::class); }
  public function reports() { return $this->hasMany(PlaceReport::class); }
  public function mergedInto() { return $this->belongsTo(self::class, 'merged_into_id'); }

  /**
   * Follow `merged_into_id` chains (A -> B -> C) to the final approved target.
   * Returns null if the chain is broken, cyclic, or ends on a non-approved place.
   */
  public function resolveCanonicalTarget(int $maxHops = 10): ?self
  {
    $current = $this;
    $visited = [(int) $this->id => true];

    for ($hop = 0; $hop < $maxHops && $current->merged_into_id !== null; $hop++) {
      $nextId = (int) $current->merged_into_id;
      if (isset($visited[$nextId])) {
        return null;
      }
      $visited[$nextId] = true;

      $next = self::find($nextId);
      if ($next === null) {
        return null;
      }

      $current = $next;
    }

    if ($current->merged_into_id !== null || $current->status !== 'approved') {
      return null;
    }

    return $current;
  }

  /** Percent-encoded /mishwar/{id}-{slug}; see PlaceUrls. */
  public function publicPath(): string { return PlaceUrls::path((int) $this->id, (string) $this->name); }
}
