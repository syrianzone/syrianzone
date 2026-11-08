<?php

namespace Database\Factories;

use App\Models\Promise;
use App\Models\PromiseSpeaker;
use Illuminate\Database\Eloquent\Factories\Factory;

class PromiseFactory extends Factory
{
    protected $model = Promise::class;

    public function definition(): array
    {
        return [
            'title' => fake()->sentence(6),
            'quote' => fake()->paragraph(),
            'quote_is_verbatim' => true,
            'speaker_id' => PromiseSpeaker::factory(),
            'sector_id' => 'electricity',
            'is_national' => true,
            'statement_date' => '2025-06-01',
            'statement_venue' => 'tv_interview',
            'deadline_wording' => 'قبل نهاية العام',
            'deadline_date' => now()->addDays(60)->format('Y-m-d'),
            'status' => 'pending',
            'review_status' => 'pending',
            'origin' => 'editor',
        ];
    }

    /** Every promise is born with one primary source, as the editor requires. */
    public function configure(): static
    {
        return $this->afterCreating(function (Promise $promise) {
            $promise->sources()->create([
                'url' => 'https://example.com/source/'.$promise->id,
                'type' => 'news_article',
                'is_primary' => true,
            ]);
        });
    }

    /**
     * Published with the next public number. Numbers are handed out per model
     * (not per query) so `count(n)->published()` gets n distinct numbers.
     */
    public function published(): static
    {
        return $this->state(fn () => [
            'review_status' => 'published',
            'number' => self::nextNumber(),
            'published_at' => now(),
        ]);
    }

    private static function nextNumber(): int
    {
        static $last = 0;

        return $last = max($last, (int) Promise::withTrashed()->max('number')) + 1;
    }

    public function overdue(): static
    {
        return $this->state(fn () => ['deadline_date' => now()->subDays(10)->format('Y-m-d')]);
    }

    public function withoutDeadline(): static
    {
        return $this->state(fn () => ['deadline_date' => null, 'deadline_wording' => null]);
    }
}
