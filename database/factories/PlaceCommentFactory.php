<?php

namespace Database\Factories;

use App\Models\Place;
use App\Models\PlaceComment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlaceComment>
 */
class PlaceCommentFactory extends Factory
{
    protected $model = PlaceComment::class;

    public function definition(): array
    {
        return [
            'body' => fake()->sentence(),
            'place_id' => Place::factory()->approved(),
            'user_id' => User::factory(),
        ];
    }
}
