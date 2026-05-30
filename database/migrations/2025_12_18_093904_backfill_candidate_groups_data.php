<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $polls = \App\Models\Poll::all();

        foreach ($polls as $poll) {
            // Find all unique categories for candidates in this poll
            $categories = \App\Models\Candidate::where('poll_id', $poll->id)
                ->whereNotNull('category')
                ->distinct()
                ->pluck('category');

            foreach ($categories as $index => $category) {
                // Determine a nice name based on the category key (legacy mapping)
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

                // Update candidates to belong to this group
                \App\Models\Candidate::where('poll_id', $poll->id)
                    ->where('category', $category)
                    ->update(['candidate_group_id' => $group->id]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Optional: clear group_ids or delete groups? 
        // For safety, we might just nullify the column, but data is preserved in 'category' field anyway as we didn't drop it.
        \App\Models\Candidate::query()->update(['candidate_group_id' => null]);
        \App\Models\CandidateGroup::truncate();
    }
};
