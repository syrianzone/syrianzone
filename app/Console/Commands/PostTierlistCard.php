<?php

namespace App\Console\Commands;

use App\Exceptions\XApiException;
use App\Services\XApiClient;
use Illuminate\Console\Command;

class PostTierlistCard extends Command
{
    protected $signature = 'tierlist:post-card {image : PNG file path} {caption : caption text file path}';

    protected $description = 'Post one weekly or monthly leaderboard card to X after human approval';

    public function handle(XApiClient $client): int
    {
        if (! $client->isConfigured()) {
            $this->error('X automation is disabled or its credentials are incomplete.');

            return self::FAILURE;
        }

        $imagePath = $this->argument('image');
        $captionPath = $this->argument('caption');
        if (! is_file($imagePath) || ! is_file($captionPath)) {
            $this->error('Image or caption file does not exist.');

            return self::FAILURE;
        }

        $caption = trim(file_get_contents($captionPath));
        if ($caption === '') {
            $this->error('Caption is empty.');

            return self::FAILURE;
        }

        // X counts a URL as 23 regardless of its length. Warn only; the
        // account may allow long posts, so the API stays the judge.
        $weighted = mb_strlen(preg_replace('~https?://\S+~u', str_repeat('x', 23), $caption));
        if ($weighted > 280) {
            $this->warn("Caption weighs {$weighted} characters; a standard account will reject it.");
        }

        try {
            $mediaId = $client->uploadMedia(file_get_contents($imagePath), basename($imagePath));
            $postId = $client->createPost($caption, [$mediaId]);
        } catch (XApiException $exception) {
            $this->error($exception->getMessage().'.');

            return self::FAILURE;
        }

        $this->info("Posted {$postId} with media {$mediaId}.");

        return self::SUCCESS;
    }
}
