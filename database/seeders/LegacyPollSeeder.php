<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class LegacyPollSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Check if exists
        $poll = \App\Models\Poll::firstOrCreate(
            ['slug' => 'best-ministers'],
            ['title' => 'Best Ministers / Governors', 'is_active' => true]
        );

        $governors = [
            ['text' => 'ماهر مروان (دمشق)', 'image_url' => '/tierlist/images/gov01.jpg'],
            ['text' => 'عزام غريب (حلب)', 'image_url' => '/tierlist/images/gov02.jpg'],
            ['text' => 'عبد الرحمن الأعمى (حمص)', 'image_url' => '/tierlist/images/gov03.jpg'],
            ['text' => 'عبد الرحمن السهيان (حماة)', 'image_url' => '/tierlist/images/gov04.jpg'],
            ['text' => 'محمد عثمان (اللاذقية)', 'image_url' => '/tierlist/images/gov05.jpg'],
            ['text' => 'أحمد الشامي (طرطوس)', 'image_url' => '/tierlist/images/gov06.jpg'],
            ['text' => 'محمد عبد الرحمن (إدلب)', 'image_url' => '/tierlist/images/gov07.jpg'],
            ['text' => 'غسان السيد (دير الزور)', 'image_url' => '/tierlist/images/gov08.jpg'],
            ['text' => 'مصطفى بكور (السويداء)', 'image_url' => '/tierlist/images/gov09.jpg'],
            ['text' => 'أنور الزعبي (درعا)', 'image_url' => '/tierlist/images/gov10.jpg'],
            ['text' => 'أحمد الدالاتي (القنيطرة)', 'image_url' => '/tierlist/images/gov11.jpg'],
            ['text' => 'عامر الشيخ (ريف دمشق)', 'image_url' => '/tierlist/images/gov12.jpg'],
        ];

        foreach ($governors as $gov) {
            \App\Models\Question::firstOrCreate(
                ['poll_id' => $poll->id, 'text' => $gov['text']],
                ['image_url' => $gov['image_url']]
            );
        }
    }
}
