<?php

namespace Database\Factories;

use App\Models\Place;
use App\Models\PlaceComment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PlaceCommentFactory extends Factory
{
  protected $model = PlaceComment::class;

  public function definition(): array
  {
    return [
      'place_id' => Place::factory(),
      'user_id' => User::factory(),
      'body' => fake()->sentence(8),
    ];
  }
}
