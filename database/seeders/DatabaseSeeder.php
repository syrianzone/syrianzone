<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        $this->call([
            \Database\Seeders\PopulationAtlasSeeder::class,
            \Database\Seeders\GuessWhoSeeder::class,
            \Database\Seeders\HouseMembers2026Seeder::class,
        ]);
    }
}
