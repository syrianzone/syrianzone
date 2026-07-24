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

    public function configure(): static
    {
        $nextSortByPlace = [];

        return $this->afterMaking(function (PlacePhoto $photo) use (&$nextSortByPlace): void {
            if ($photo->sort !== null) {
                return;
            }

            $placeId = (int) $photo->place_id;
            if (! array_key_exists($placeId, $nextSortByPlace)) {
                $max = PlacePhoto::where('place_id', $placeId)->max('sort');
                $nextSortByPlace[$placeId] = $max === null ? 0 : (int) $max + 1;
            }

            $photo->sort = $nextSortByPlace[$placeId]++;
        });
    }

    public function definition(): array
    {
        $id = (string) Str::uuid();

        return [
            'display_path' => fn (array $attributes) => "places/{$attributes['place_id']}/{$id}_display.webp",
            'original_path' => fn (array $attributes) => "places/{$attributes['place_id']}/{$id}.jpg",
            'place_id' => Place::factory(),
            'sort' => null,
            'thumb_path' => fn (array $attributes) => "places/{$attributes['place_id']}/{$id}_thumb.webp",
        ];
    }
}
