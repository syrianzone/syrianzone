<?php

namespace Database\Factories;

use App\Models\GovApp;
use Illuminate\Database\Eloquent\Factories\Factory;

class GovAppFactory extends Factory
{
  protected $model = GovApp::class;

  public function definition(): array
  {
    return [
      'id' => fake()->unique()->slug(2),
      'name' => fake()->words(2, true),
      'name_ar' => fake()->words(2, true),
      'description' => fake()->sentence(12),
      'description_ar' => fake()->sentence(12),
      'icon' => null,
      'images' => [],
      'links' => [],
      'order_column' => fake()->numberBetween(1, 20),
      'is_active' => true,
    ];
  }

  public function inactive(): static
  {
    return $this->state(fn () => ['is_active' => false]);
  }
}
