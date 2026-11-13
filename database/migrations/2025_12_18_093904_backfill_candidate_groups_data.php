<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $polls = \App\Models\Poll::all();

        foreach ($polls as $poll) {
            $categories = \App\Models\Candidate::where('poll_id', $poll->id)
                ->whereNotNull('category')
                ->distinct()
                ->pluck('category');

            foreach ($categories as $index => $category) {
                $name = match ($category) {
                    'minister' => 'الحكومة',
                    'governor' => 'المحافظون',
                    'security' => 'مسؤولو الأمن',
                    'jolani' => 'شخصيات الجولاني',
                    default => ucfirst($category),
                };

                $group = \App\Models\CandidateGroup::firstOrCreate(
                    [
                        'poll_id' => $poll->id,
                        'key' => $category,
                    ],
                    [
                        'name' => $name,
                        'sort_order' => $index, // Simple initial sort
                    ]
                );

                \App\Models\Candidate::where('poll_id', $poll->id)
                    ->where('category', $category)
                    ->update(['candidate_group_id' => $group->id]);
            }
        }
    }

    public function down(): void
    {
        \App\Models\Candidate::query()->update(['candidate_group_id' => null]);
        \App\Models\CandidateGroup::truncate();
    }
};
