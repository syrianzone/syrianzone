<?php

namespace Database\Factories;

use App\Models\OfficialCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

class OfficialCategoryFactory extends Factory
{
  protected $model = OfficialCategory::class;

  public function definition(): array
  {
    return [
      'id' => fake()->unique()->slug(2),
      'label_ar' => fake()->word(),
      'label_en' => fake()->words(2, true),
      'icon' => fake()->randomElement(['landmark', 'bank', 'hospital', null]),
      'order_column' => fake()->numberBetween(1, 20),
      'is_active' => true,
    ];
  }

  public function inactive(): static
  {
    return $this->state(fn () => ['is_active' => false]);
  }
}
