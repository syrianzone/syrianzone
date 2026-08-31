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

    // Every group is watched independently; returns the newly prepared posts.
    public function detect(Poll $poll): array
    {
        if (! $this->client->isConfigured()) {
            return [];
        }

        return Cache::lock("tierlist-social-poll:{$poll->id}", 45)
            ->block(10, fn () => $this->detectWithinLock($poll));
    }

    private function detectWithinLock(Poll $poll): array
    {
        return DB::transaction(function () use ($poll) {
            Poll::query()->whereKey($poll->id)->lockForUpdate()->firstOrFail();
            $snapshot = $this->leaderboard->snapshot($poll);
            $states = TierlistSocialState::query()
                ->where('poll_id', $poll->id)
                ->lockForUpdate()
                ->get()
                ->keyBy('group_key');

            $created = [];
            foreach ($snapshot['groups'] as $group) {
                $post = $this->detectGroup($poll, $group, $states->get($group['key']));
                if ($post !== null) {
                    $created[] = $post;
                }
            }

            return $created;
        });
    }

    private function detectGroup(Poll $poll, array $group, ?TierlistSocialState $state): ?TierlistSocialPost
    {
        if (! $state) {
            TierlistSocialState::create([
                'poll_id' => $poll->id,
                'group_key' => $group['key'],
                'observed_hash' => $group['hash'],
                'observed_snapshot' => $group['candidates'],
                'observed_at' => now(),
                'published_hash' => $group['hash'],
                'published_snapshot' => $group['candidates'],
                'published_at' => now(),
            ]);

            return null;
        }

        if ($group['hash'] === $state->published_hash) {
            if ($state->observed_hash !== $group['hash']) {
                $state->update([
                    'observed_hash' => $group['hash'],
                    'observed_snapshot' => $group['candidates'],
                    'observed_at' => now(),
                ]);
            }

            return null;
        }

        if ($group['hash'] !== $state->observed_hash) {
            $state->update([
                'observed_hash' => $group['hash'],
                'observed_snapshot' => $group['candidates'],
                'observed_at' => now(),
            ]);

            return null;
        }

        $settleMinutes = max(0, (int) config('services.x_tierlist.settle_minutes', 15));
        if ($state->observed_at->gt(now()->subMinutes($settleMinutes))) {
            return null;
        }

        $text = $this->postText->make($state->published_snapshot, $state->observed_snapshot);

        if ($text === null) {
            // Order changed without a nameable movement (a candidate left the
            // ranking). Adopt it silently; no budget spent.
            $state->update([
                'published_hash' => $state->observed_hash,
                'published_snapshot' => $state->observed_snapshot,
                'published_at' => now(),
            ]);

            return null;
        }

        // The budget spans the poll, so simultaneous changes in several groups
        // announce one group per interval window rather than bursting.
        if (! $this->hasPostingBudget($poll)) {
            return null;
        }

        // NOTE: observed_at stays in the hash on purpose: a repeated
        // transition (A->B delivered, later A->B again) must mint a new row.
        // The cost is that a settled wobble can mint a duplicate pending row,
        // which the budget limits and the claim-time supersede check refuses
        // to deliver twice.
        $transitionHash = hash('sha256', implode('|', [
            $poll->id,
            $group['key'],
            $state->published_hash,
            $state->observed_hash,
            $state->observed_at->toIso8601String(),
        ]));

        $post = TierlistSocialPost::firstOrCreate([
            'transition_hash' => $transitionHash,
        ], [
            'poll_id' => $poll->id,
            'group_key' => $group['key'],
            'before_hash' => $state->published_hash,
            'after_hash' => $state->observed_hash,
            'before_snapshot' => $state->published_snapshot,
            'after_snapshot' => $state->observed_snapshot,
            'text' => $text,
            'status' => 'pending',
        ]);

        return $post->wasRecentlyCreated ? $post : null;
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
