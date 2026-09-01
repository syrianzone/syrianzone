<?php

namespace App\Console\Commands;

use App\Exceptions\XApiException;
use App\Exceptions\XTransientException;
use App\Models\AnswerSocialPost;
use App\Services\XApiClient;
use Illuminate\Console\Command;
use Illuminate\Database\UniqueConstraintViolationException;

class PostAnswerCard extends Command
{
    protected $signature = 'answers:post-card {image : PNG file path} {meta : JSON meta file path}';

    protected $description = 'Post one community answer card to X';

    public function handle(XApiClient $client): int
    {
        if (! $client->isConfigured()) {
            $this->error('X automation is disabled or its credentials are incomplete.');

            return self::FAILURE;
        }

        $imagePath = $this->argument('image');
        $metaPath = $this->argument('meta');
        if (! is_file($imagePath) || ! is_file($metaPath)) {
            $this->error('Image or meta file does not exist.');

            return self::FAILURE;
        }

        $meta = json_decode(file_get_contents($metaPath), true);
        $answerId = is_array($meta) ? ($meta['answer_id'] ?? null) : null;
        $caption = is_array($meta) ? ($meta['caption'] ?? null) : null;
        if (! is_string($answerId) || $answerId === '' || ! is_string($caption) || $caption === '') {
            $this->error('Meta file must carry a non-empty answer_id and caption.');

            return self::FAILURE;
        }

        // X counts a URL as 23 regardless of its length. Warn only; the
        // account may allow long posts, so the API stays the judge.
        $weighted = mb_strlen(preg_replace('~https?://\S+~u', str_repeat('x', 23), $caption));
        if ($weighted > 280) {
            $this->warn("Caption weighs {$weighted} characters; a standard account will reject it.");
        }

        // NOTE: failed rows are not retried on purpose. An ambiguous failure
        // may have posted anyway, so a human inspects the account and decides
        // by deleting the row; the workflow re-run then posts at most once.
        $existing = AnswerSocialPost::query()->where('answer_id', $answerId)->first();
        if ($existing !== null) {
            $this->info("answer {$answerId} already handled ({$existing->status}), skipping.");

            return self::SUCCESS;
        }

        // Claim the row before any network call so overlapping runs cannot
        // both post; the unique answer_id is the at-most-once gate.
        try {
            $post = AnswerSocialPost::create([
                'answer_id' => $answerId,
                'question_id' => is_string($meta['question_id'] ?? null) ? $meta['question_id'] : '',
                'title' => is_string($meta['title'] ?? null) ? $meta['title'] : '',
                'url' => is_string($meta['url'] ?? null) ? $meta['url'] : '',
                'caption' => $caption,
                'status' => 'sending',
            ]);
        } catch (UniqueConstraintViolationException) {
            $this->info("answer {$answerId} already handled (claimed concurrently), skipping.");

            return self::SUCCESS;
        }

        try {
            $mediaId = $client->uploadMedia(file_get_contents($imagePath), basename($imagePath));
            $postId = $client->createPost($caption, [$mediaId]);
        } catch (XTransientException $exception) {
            // A transient failure (rate limit, 5xx upload, connection loss
            // before the tweet) cannot have posted, so release the claim and
            // let the next scheduled run retry from scratch.
            $post->delete();
            $this->error($exception->getMessage().'.');

            return self::FAILURE;
        } catch (XApiException $exception) {
            $post->update([
                'status' => 'failed',
                'last_error' => $exception->statusCode === null
                    ? $exception->getMessage()
                    : "{$exception->getMessage()} (HTTP {$exception->statusCode})",
            ]);
            $this->error($exception->getMessage().'.');

            return self::FAILURE;
        }

        $post->update([
            'status' => 'posted',
            'x_post_id' => $postId,
            'posted_at' => now(),
        ]);

        $this->info("Posted {$postId} with media {$mediaId}.");

        return self::SUCCESS;
    }
}
