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

        $r2BaseUrl = rtrim((string) (env('R2_PUBLIC_URL') ?: (config('filesystems.disks.r2.url') ?: 'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev')), '/');
        $governors = [
            ['text' => 'ماهر مروان (دمشق)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov01.jpg'],
            ['text' => 'عزام غريب (حلب)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov02.jpg'],
            ['text' => 'عبد الرحمن الأعمى (حمص)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov03.jpg'],
            ['text' => 'عبد الرحمن السهيان (حماة)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov04.jpg'],
            ['text' => 'محمد عثمان (اللاذقية)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov05.jpg'],
            ['text' => 'أحمد الشامي (طرطوس)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov06.jpg'],
            ['text' => 'محمد عبد الرحمن (إدلب)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov07.jpg'],
            ['text' => 'غسان السيد (دير الزور)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov08.jpg'],
            ['text' => 'مصطفى بكور (السويداء)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov09.jpg'],
            ['text' => 'أنور الزعبي (درعا)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov10.jpg'],
            ['text' => 'أحمد الدالاتي (القنيطرة)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov11.jpg'],
            ['text' => 'عامر الشيخ (ريف دمشق)', 'image_url' => $r2BaseUrl . '/tierlist/candidates/gov12.jpg'],
        ];

        foreach ($governors as $gov) {
            \App\Models\Question::firstOrCreate(
                ['poll_id' => $poll->id, 'text' => $gov['text']],
                ['image_url' => $gov['image_url']]
            );
        }
    }
}
