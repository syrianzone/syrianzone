<?php

namespace App\Services;

use App\Models\Poll;
use App\Models\TierlistSocialPost;
use App\Models\TierlistSocialState;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class TierlistChangeDetector
{
    public function __construct(
        private readonly TierlistLeaderboard $leaderboard,
        private readonly TierlistPostText $postText,
        private readonly XApiClient $client,
    ) {}

    public function detect(Poll $poll): ?TierlistSocialPost
    {
        if (! $this->client->isConfigured()) {
            return null;
        }

        return Cache::lock("tierlist-social-poll:{$poll->id}", 45)
            ->block(10, fn () => $this->detectWithinLock($poll));
    }

    private function detectWithinLock(Poll $poll): ?TierlistSocialPost
    {
        return DB::transaction(function () use ($poll) {
            Poll::query()->whereKey($poll->id)->lockForUpdate()->firstOrFail();
            $snapshot = $this->leaderboard->snapshot($poll);
            $state = TierlistSocialState::query()
                ->where('poll_id', $poll->id)
                ->lockForUpdate()
                ->first();

            if (! $state) {
                TierlistSocialState::create([
                    'poll_id' => $poll->id,
                    'observed_hash' => $snapshot['hash'],
                    'observed_snapshot' => $snapshot['groups'],
                    'observed_at' => now(),
                    'published_hash' => $snapshot['hash'],
                    'published_snapshot' => $snapshot['groups'],
                    'published_at' => now(),
                ]);

                return null;
            }

            if ($snapshot['hash'] === $state->published_hash) {
                if ($state->observed_hash !== $snapshot['hash']) {
                    $state->update([
                        'observed_hash' => $snapshot['hash'],
                        'observed_snapshot' => $snapshot['groups'],
                        'observed_at' => now(),
                    ]);
                }

                return null;
            }

            if ($snapshot['hash'] !== $state->observed_hash) {
                $state->update([
                    'observed_hash' => $snapshot['hash'],
                    'observed_snapshot' => $snapshot['groups'],
                    'observed_at' => now(),
                ]);

                return null;
            }

            $settleMinutes = max(0, (int) config('services.x_tierlist.settle_minutes', 15));
            if ($state->observed_at->gt(now()->subMinutes($settleMinutes))) {
                return null;
            }

            if (! $this->hasPostingBudget($poll)) {
                return null;
            }

            $transitionHash = hash('sha256', implode('|', [
                $poll->id,
                $state->published_hash,
                $state->observed_hash,
                $state->observed_at->toIso8601String(),
            ]));

            $post = TierlistSocialPost::firstOrCreate([
                'transition_hash' => $transitionHash,
            ], [
                'poll_id' => $poll->id,
                'before_hash' => $state->published_hash,
                'after_hash' => $state->observed_hash,
                'before_snapshot' => $state->published_snapshot,
                'after_snapshot' => $state->observed_snapshot,
                'text' => $this->postText->make(
                    $state->published_snapshot,
                    $state->observed_snapshot,
                ),
                'status' => 'pending',
            ]);

            return $post->wasRecentlyCreated ? $post : null;
        });
    }

    private function hasPostingBudget(Poll $poll): bool
    {
        $dailyLimit = max(0, (int) config('services.x_tierlist.daily_post_limit', 4));
        if ($dailyLimit === 0) {
            return false;
        }

        $query = TierlistSocialPost::query()->where('poll_id', $poll->id);
        if ((clone $query)->where(function ($dailyQuery) {
            $dailyQuery->where('created_at', '>=', now()->startOfDay())
                ->orWhere('posted_at', '>=', now()->startOfDay());
        })->count() >= $dailyLimit) {
            return false;
        }

        $minimumMinutes = max(0, (int) config('services.x_tierlist.min_post_interval_minutes', 60));
        $latestPrepared = (clone $query)->latest('created_at')->first('created_at');
        $latestPosted = (clone $query)
            ->whereNotNull('posted_at')
            ->latest('posted_at')
            ->first('posted_at');
        $latestActivity = $latestPrepared?->created_at;

        if ($latestPosted?->posted_at && (! $latestActivity || $latestPosted->posted_at->gt($latestActivity))) {
            $latestActivity = $latestPosted->posted_at;
        }

        return ! $latestActivity || $latestActivity->lte(now()->subMinutes($minimumMinutes));
    }
}
