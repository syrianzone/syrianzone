<?php

namespace Database\Factories;

use App\Models\Place;
use App\Models\PlacePhoto;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PlacePhotoFactory extends Factory
{
  protected $model = PlacePhoto::class;

  public function definition(): array
  {
    $uuid = (string) Str::uuid();
    return [
      'place_id' => Place::factory(),
      'original_path' => "places/1/{$uuid}.jpg",
      'display_path' => "places/1/{$uuid}_display.webp",
      'thumb_path' => "places/1/{$uuid}_thumb.webp",
      'sort' => 0,
    ];
  }
}
