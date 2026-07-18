<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Board>
 */
class BoardFactory extends Factory
{
  public function definition(): array
  {
    return [
      'user_id' => User::factory()->create(['role' => 'user'])->id,
      'version' => 1,
      'document' => [
        'v' => 1,
        'activeId' => 'd_main',
        'updatedAt' => now()->toIso8601String(),
        'dashboards' => [
          ['id' => 'd_main', 'name' => 'الرئيسية', 'widgets' => [
            ['i' => 'w_seed', 'd' => 'clock', 'w' => 4, 'h' => 1, 'c' => ['format' => '24']],
          ]],
        ],
      ],
    ];
  }
}
