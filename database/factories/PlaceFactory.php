<?php

namespace Database\Factories;

use App\Models\Place;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Place>
 */
class PlaceFactory extends Factory
{
    protected $model = Place::class;

    public function definition(): array
    {
        return [
            'category' => fake()->randomElement(Place::CATEGORIES),
            'description' => fake()->paragraph(),
            'lat' => fake()->randomFloat(7, 32.5, 37),
            'lng' => fake()->randomFloat(7, 35.8, 42),
            'name' => fake()->city(),
            'status' => 'pending',
            'user_id' => User::factory(),
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => [
            'approved_at' => now(),
            'status' => 'approved',
        ]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => [
            'approved_at' => null,
            'status' => 'rejected',
        ]);
    }
}
