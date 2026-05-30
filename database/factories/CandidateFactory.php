<?php

namespace Database\Factories;

use App\Models\Candidate;
use App\Models\Poll;
use Illuminate\Database\Eloquent\Factories\Factory;

class CandidateFactory extends Factory
{
    protected $model = Candidate::class;

    public function definition(): array
    {
        return [
            'poll_id' => Poll::factory(),
            'name' => fake()->name(),
            'title' => fake()->jobTitle(),
            'category' => 'minister',
            'sort' => 0,
        ];
    }
}
