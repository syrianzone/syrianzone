<?php

namespace Database\Factories;

use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use Illuminate\Database\Eloquent\Factories\Factory;

class OfficialEntityFactory extends Factory
{
  protected $model = OfficialEntity::class;

  public function definition(): array
  {
    return [
      'id' => fake()->unique()->slug(2),
      'category_id' => OfficialCategory::factory(),
      'name' => fake()->company(),
      'name_ar' => fake()->company(),
      'description' => fake()->sentence(12),
      'description_ar' => fake()->sentence(12),
      'image' => 'images/governorates/placeholder.webp',
      'socials' => [],
      'order_column' => fake()->numberBetween(1, 20),
      'is_active' => true,
    ];
  }

  public function inactive(): static
  {
    return $this->state(fn () => ['is_active' => false]);
  }

  public function inCategory(string|OfficialCategory $category): static
  {
    return $this->state(fn () => [
      'category_id' => $category instanceof OfficialCategory ? $category->id : $category,
    ]);
  }
}
