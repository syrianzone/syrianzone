<?php

namespace Database\Factories;

use App\Models\Contributor;
use Illuminate\Database\Eloquent\Factories\Factory;

class ContributorFactory extends Factory
{
    protected $model = Contributor::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'avatar_url' => fake()->imageUrl(),
            'profile_url' => fake()->url(),
            'total_contributions' => fake()->numberBetween(1, 100),
        ];
    }
}
