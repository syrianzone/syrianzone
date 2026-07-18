<?php

namespace Database\Factories;

use App\Models\Place;
use App\Models\PlacePhoto;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PlacePhoto>
 */
class PlacePhotoFactory extends Factory
{
    protected $model = PlacePhoto::class;

    public function definition(): array
    {
        $id = (string) Str::uuid();

        return [
            'display_path' => fn (array $attributes) => "places/{$attributes['place_id']}/{$id}_display.webp",
            'original_path' => fn (array $attributes) => "places/{$attributes['place_id']}/{$id}.jpg",
            'place_id' => Place::factory(),
            'sort' => 0,
            'thumb_path' => fn (array $attributes) => "places/{$attributes['place_id']}/{$id}_thumb.webp",
        ];
    }
}
