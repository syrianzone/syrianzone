<?php

namespace App\Services;

use App\Jobs\PostTierlistChangeToX;
use App\Models\Poll;
use App\Models\TierlistSocialPost;

class TierlistSocialOutbox
{
    public function relayPending(Poll $poll): int
    {
        $posts = TierlistSocialPost::query()
            ->where('poll_id', $poll->id)
            ->where('status', 'pending')
            ->orderBy('created_at')
            ->limit(10)
            ->get(['id', 'poll_id']);

        foreach ($posts as $post) {
            PostTierlistChangeToX::dispatch($post->id, $post->poll_id);
        }

        return $posts->count();
    }
}
