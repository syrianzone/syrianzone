<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Hotel extends Model
{
  protected $fillable = [
    'hala_syria_id', 'name', 'name_ar', 'city', 'city_ar', 'city_slug', 'slug',
    'lat', 'lng', 'star_rating', 'rating', 'review_count',
    'now_show_rate', 'currency', 'address', 'address_ar',
    'phone', 'email', 'description', 'description_ar', 'images',
    'has_restaurant', 'has_swimming_pool', 'has_spa', 'has_fitness_center',
    'has_parking', 'has_airport_shuttle', 'has_bar', 'has_room_service',
    'source_url', 'last_synced_at',
  ];

  protected $casts = [
    'lat' => 'float',
    'lng' => 'float',
    'now_show_rate' => 'float',
    'rating' => 'float',
    'images' => 'array',
    'has_restaurant' => 'boolean',
    'has_swimming_pool' => 'boolean',
    'has_spa' => 'boolean',
    'has_fitness_center' => 'boolean',
    'has_parking' => 'boolean',
    'has_airport_shuttle' => 'boolean',
    'has_bar' => 'boolean',
    'has_room_service' => 'boolean',
    'last_synced_at' => 'datetime',
  ];

  public function getThumbUrlAttribute(): ?string
  {
    $images = $this->images;
    return is_array($images) && count($images) > 0 ? $images[0] : null;
  }
}
