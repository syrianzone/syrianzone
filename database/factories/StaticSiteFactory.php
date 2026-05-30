<?php

namespace Database\Factories;

use App\Models\StaticSite;
use Illuminate\Database\Eloquent\Factories\Factory;

class StaticSiteFactory extends Factory
{
    protected $model = StaticSite::class;

    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'slug' => fake()->unique()->slug(),
            'path' => '/sites/' . fake()->slug(),
            'is_visible' => true,
        ];
    }
}
