<?php

namespace Database\Factories;

use App\Models\PromiseSpeaker;
use Illuminate\Database\Eloquent\Factories\Factory;

class PromiseSpeakerFactory extends Factory
{
    protected $model = PromiseSpeaker::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'title' => 'وزير '.fake()->word(),
            'status' => 'approved',
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => 'pending']);
    }
}
