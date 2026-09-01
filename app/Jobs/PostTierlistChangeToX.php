<?php

namespace App\Jobs;

use App\Exceptions\XAmbiguousException;
use App\Exceptions\XApiException;
use App\Exceptions\XConfigurationException;
use App\Exceptions\XPermanentException;
use App\Exceptions\XTransientException;
use App\Models\TierlistSocialPost;
use App\Models\TierlistSocialState;
use App\Services\XApiClient;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PostTierlistChangeToX implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public int $timeout = 45;

    public int $uniqueFor = 300;

    public function __construct(
        public string $postId,
        public string $pollId,
    ) {}

    public function uniqueId(): string
    {
        return $this->postId;
    }

    public function middleware(): array
    {
        return [
            (new WithoutOverlapping("tierlist-social-poll:{$this->pollId}"))
                ->shared()
                ->releaseAfter(60)
                ->expireAfter(120),
        ];
    }

    public function backoff(): array
    {
        return [60, 300, 900, 3600];
    }

    public function handle(XApiClient $client): void
    {
        Cache::lock("tierlist-social-poll:{$this->pollId}", 60)
            ->block(10, fn () => $this->deliverWithinLock($client));
    }

    public function failed(?\Throwable $exception): void
    {
        TierlistSocialPost::query()
            ->whereKey($this->postId)
            ->where('status', 'sending')
            ->update([
                'status' => 'needs_review',
                'last_error' => 'Delivery stopped while the X outcome was unknown',
            ]);

        TierlistSocialPost::query()
            ->whereKey($this->postId)
            ->whereIn('status', ['pending', 'retrying'])
            ->update([
                'status' => 'failed',
                'last_error' => 'X delivery exhausted its retries',
            ]);

        if ($exception) {
            report($exception);
        }
    }

    private function deliverWithinLock(XApiClient $client): void
    {
        $post = $this->claim();
        if (! $post) {
            return;
        }

        try {
            $xPostId = $client->createPost($post->text);
        } catch (XAmbiguousException $exception) {
            $this->recordApiFailure($post, $exception, 'needs_review');
            report($exception);

            return;
        } catch (XConfigurationException $exception) {
            $this->recordApiFailure($post, $exception, 'pending');
            report($exception);

            return;
        } catch (XTransientException $exception) {
            $this->recordApiFailure($post, $exception, 'retrying');

            throw $exception;
        } catch (XPermanentException $exception) {
            $this->recordApiFailure($post, $exception, 'failed');
            report($exception);

            return;
        }

        DB::transaction(function () use ($post, $xPostId) {
            $lockedPost = TierlistSocialPost::query()->lockForUpdate()->findOrFail($post->id);
            if ($lockedPost->status !== 'sending') {
                return;
            }

            $lockedPost->update([
                'status' => 'posted',
                'x_post_id' => $xPostId,
                'last_http_status' => 201,
                'last_error' => null,
                'posted_at' => now(),
            ]);

            $state = TierlistSocialState::query()
                ->where('poll_id', $lockedPost->poll_id)
                ->where('group_key', $lockedPost->group_key)
                ->lockForUpdate()
                ->first();

            if ($state
                && $state->published_hash === $lockedPost->before_hash
                && $state->observed_hash === $lockedPost->after_hash) {
                $state->update([
                    'published_hash' => $lockedPost->after_hash,
                    'published_snapshot' => $lockedPost->after_snapshot,
                    'published_at' => now(),
                ]);
            }
        });
    }

    private function claim(): ?TierlistSocialPost
    {
        return DB::transaction(function () {
            $post = TierlistSocialPost::query()->lockForUpdate()->find($this->postId);
            if (! $post || in_array($post->status, ['posted', 'failed', 'needs_review', 'superseded'], true)) {
                return null;
            }

            if ($post->status === 'sending') {
                $post->update([
                    'status' => 'needs_review',
                    'last_error' => 'A previous delivery stopped while the X outcome was unknown',
                ]);

                return null;
            }

            if (! in_array($post->status, ['pending', 'retrying'], true)) {
                return null;
            }

            // Rows without a group predate per-group detection and are stale.
            $state = $post->group_key === null ? null : TierlistSocialState::query()
                ->where('poll_id', $post->poll_id)
                ->where('group_key', $post->group_key)
                ->lockForUpdate()
                ->first();
            if (! $state
                || $state->observed_hash !== $post->after_hash
                || $state->published_hash !== $post->before_hash) {
                $post->update([
                    'status' => 'superseded',
                    'last_error' => 'A newer ranking replaced this transition',
                ]);

                return null;
            }

            // The budget is checked at preparation, but a delayed retry or a
            // drained queue could still deliver two groups back to back.
            // Leave the row pending; the scheduler relay retries it later.
            $minimumMinutes = max(0, (int) config('services.x_tierlist.min_post_interval_minutes', 720));
            $recentlyPosted = TierlistSocialPost::query()
                ->where('poll_id', $post->poll_id)
                ->whereKeyNot($post->id)
                ->whereNotNull('posted_at')
                ->where('posted_at', '>', now()->subMinutes($minimumMinutes))
                ->exists();
            if ($recentlyPosted) {
                $post->update(['status' => 'pending']);

                return null;
            }

            $post->update([
                'status' => 'sending',
                'attempts' => $post->attempts + 1,
                'attempted_at' => now(),
                'last_error' => null,
            ]);

            return $post->fresh();
        });
    }

    private function recordApiFailure(
        TierlistSocialPost $post,
        XApiException $exception,
        string $status,
    ): void {
        $post->update([
            'status' => $status,
            'last_http_status' => $exception->statusCode,
            'last_error' => $exception->getMessage(),
        ]);
    }
}
