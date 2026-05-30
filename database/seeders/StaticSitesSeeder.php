<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class StaticSitesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $sites = [
            ['slug' => 'alignment', 'name' => 'Legacy Alignment', 'path' => '/alignment/index.html'],
            ['slug' => 'bingo', 'name' => 'Bingo', 'path' => '/bingo/index.html'],
            ['slug' => 'board', 'name' => 'Issues Board', 'path' => '/board/index.html'],
            ['slug' => 'compass', 'name' => 'Political Compass', 'path' => '/compass/index.html'],
            ['slug' => 'game', 'name' => 'Game Prototype', 'path' => '/game/index.html'],
            ['slug' => 'hotels', 'name' => 'Syrian Hotels', 'path' => '/hotels/index.html'],
            ['slug' => 'house', 'name' => 'House of Representatives', 'path' => '/house/index.html'],
            ['slug' => 'legacytierlist', 'name' => 'Legacy Tierlist', 'path' => '/legacytierlist/index.html'],
            ['slug' => 'party', 'name' => 'Political Parties', 'path' => '/party/index.html'],
            ['slug' => 'population', 'name' => 'Population Stats', 'path' => '/population/index.html'],
            ['slug' => 'syid', 'name' => 'Syrian Identity', 'path' => '/syid/index.html'],
            ['slug' => 'syofficial', 'name' => 'Official Accounts', 'path' => '/syofficial/index.html'],
            ['slug' => 'stats', 'name' => 'Statistics', 'path' => '/stats/index.html'],
            ['slug' => 'sites', 'name' => 'Sites', 'path' => '/sites/index.html'],
        ];

        foreach ($sites as $site) {
            \App\Models\StaticSite::updateOrCreate(
                ['slug' => $site['slug']],
                [
                    'name' => $site['name'],
                    'path' => $site['path'],
                    'is_visible' => true
                ]
            );
        }
    }
}
