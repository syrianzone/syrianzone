<?php

namespace Database\Factories;

use App\Models\Place;
use App\Models\User;
use App\Services\Places\PlaceRules;
use Illuminate\Database\Eloquent\Factories\Factory;

class PlaceFactory extends Factory
{
  protected $model = Place::class;

  public function definition(): array
  {
    [$minLng, $minLat, $maxLng, $maxLat] = PlaceRules::syriaBox();

    return [
      'user_id' => User::factory(),
      'name' => fake()->city(),
      'category' => fake()->randomElement(PlaceRules::categories()),
      'description' => fake()->sentence(12),
      'lat' => fake()->randomFloat(7, $minLat, $maxLat),
      'lng' => fake()->randomFloat(7, $minLng, $maxLng),
      'status' => 'pending',
    ];
  }

  public function approved(): static
  {
    return $this->state(fn () => ['status' => 'approved', 'approved_at' => now()]);
  }

  public function rejected(): static
  {
    return $this->state(fn () => ['status' => 'rejected']);
  }
}
