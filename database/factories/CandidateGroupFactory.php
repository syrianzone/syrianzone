<?php

namespace Database\Factories;

use App\Models\CandidateGroup;
use App\Models\Poll;
use Illuminate\Database\Eloquent\Factories\Factory;

class CandidateGroupFactory extends Factory
{
    protected $model = CandidateGroup::class;

    public function definition(): array
    {
        return [
            'poll_id' => Poll::factory(),
            'name' => fake()->word(),
            'key' => fake()->unique()->slug(),
            'sort_order' => 0,
            'is_default' => false,
        ];
    }
}
