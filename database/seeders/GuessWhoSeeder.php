<?php

namespace Database\Seeders;

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\Poll;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class GuessWhoSeeder extends Seeder
{
    public function run(): void
    {
        // Find the main best-ministers poll
        $poll = Poll::where('slug', 'best-ministers')->first();
        if (!$poll) {
            $this->command->info("Best Ministers poll not found. Seeding with dummy categories.");
            $this->seedDummyData();
            return;
        }

        $groups = CandidateGroup::where('poll_id', $poll->id)->get();

        foreach ($groups as $group) {
            // Create GuessWhoCategory
            $category = GuessWhoCategory::updateOrCreate(
                ['slug' => Str::slug($group->key ?? $group->name)],
                [
                    'name_ar' => $group->name,
                    'name_en' => Str::title(str_replace('_', ' ', $group->key ?? $group->name)),
                    'is_active' => true,
                ]
            );

            // Fetch active candidates for this group
            $candidates = Candidate::where('candidate_group_id', $group->id)
                ->where('status', 'active')
                ->get();

            $this->command->info("Seeding category: {$category->name_ar} with {$candidates->count()} characters.");

            foreach ($candidates as $candidate) {
                $imagePath = $this->processCandidateImage($candidate->image_url);

                if (!$imagePath) {
                    $this->command->warn("Skipping candidate {$candidate->name} due to missing/inaccessible image.");
                    continue;
                }

                GuessWhoCharacter::updateOrCreate(
                    [
                        'category_id' => $category->id,
                        'name_ar' => $candidate->name,
                    ],
                    [
                        'name_en' => $candidate->name,
                        'image_path' => $imagePath,
                        'attributes' => [
                            'title' => $candidate->title,
                            'category' => $candidate->category,
                        ],
                        'is_active' => true,
                    ]
                );
            }
        }
    }

    private function processCandidateImage(?string $imageUrl): ?string
    {
        if (empty($imageUrl)) {
            return null;
        }

        $extension = pathinfo($imageUrl, PATHINFO_EXTENSION) ?: 'jpg';
        // Clean extensions (remove query params if any)
        $extension = explode('?', $extension)[0];
        if (!in_array(strtolower($extension), ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'])) {
            $extension = 'jpg';
        }

        $filename = 'char_' . md5($imageUrl) . '.' . $extension;
        $targetPath = 'guesswho/characters/' . $filename;

        // Check if file already exists in public storage
        if (Storage::disk('public')->exists($targetPath)) {
            return $targetPath;
        }

        // If it is an external URL, download it
        if (Str::startsWith($imageUrl, ['http://', 'https://'])) {
            try {
                $response = Http::get($imageUrl);
                if ($response->successful()) {
                    Storage::disk('public')->put($targetPath, $response->body());
                    return $targetPath;
                }
            } catch (\Exception $e) {
                // Ignore download error
            }
            return null;
        }

        // If it is stored locally under public disk, copy it
        $localSourcePath = Str::replaceFirst('/storage/', '', $imageUrl);
        if (Storage::disk('public')->exists($localSourcePath)) {
            Storage::disk('public')->copy($localSourcePath, $targetPath);
            return $targetPath;
        }

        // Fallback: If it's a relative path in public/ folder (e.g. /images/...)
        $publicPath = public_path($imageUrl);
        if (file_exists($publicPath) && is_file($publicPath)) {
            $content = file_get_contents($publicPath);
            Storage::disk('public')->put($targetPath, $content);
            return $targetPath;
        }

        return null;
    }

    private function seedDummyData(): void
    {
        // In case best-ministers does not exist on local dev (dummy fallback)
        $category = GuessWhoCategory::updateOrCreate(
            ['slug' => 'test-category'],
            [
                'name_ar' => 'فئة تجريبية',
                'name_en' => 'Test Category',
                'is_active' => true,
            ]
        );

        for ($i = 1; $i <= 12; $i++) {
            GuessWhoCharacter::updateOrCreate(
                [
                    'category_id' => $category->id,
                    'name_ar' => "شخصية تجريبية {$i}",
                ],
                [
                    'name_en' => "Test Character {$i}",
                    'image_path' => "guesswho/characters/dummy_{$i}.jpg",
                    'attributes' => ['gender' => $i % 2 === 0 ? 'male' : 'female'],
                    'is_active' => true,
                ]
            );
        }
    }
}
