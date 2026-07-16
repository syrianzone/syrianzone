<?php

namespace Database\Factories;

use App\Models\Place;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PlaceFactory extends Factory
{
  protected $model = Place::class;

  public function definition(): array
  {
    return [
      'user_id' => User::factory(),
      'name' => fake()->city(),
      'category' => fake()->randomElement(['historical', 'natural', 'cultural', 'religious', 'abandoned', 'viewpoint', 'market', 'other']),
      'description' => fake()->sentence(12),
      'lat' => fake()->randomFloat(7, 32.5, 37.0),
      'lng' => fake()->randomFloat(7, 35.8, 42.0),
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
