<?php

namespace App\Observers\IndexNow;

use App\Models\Poll;
use App\Services\IndexNow\IndexNow;

class PollObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(Poll $poll): void
    {
        if ($poll->is_active && filled($poll->slug)) {
            $this->indexNow->queue($this->pathFor((string) $poll->slug));
        }
    }

    public function updated(Poll $poll): void
    {
        $paths = [];

        if ($poll->is_active && filled($poll->slug)) {
            $paths[] = $this->pathFor((string) $poll->slug);
        }

        if ((bool) $poll->getOriginal('is_active') && filled($poll->getOriginal('slug'))) {
            $paths[] = $this->pathFor((string) $poll->getOriginal('slug'));
        }

        if ($paths !== []) {
            $this->indexNow->queue($paths);
        }
    }

    public function deleted(Poll $poll): void
    {
        if ($poll->is_active && filled($poll->slug)) {
            $this->indexNow->queue($this->pathFor((string) $poll->slug));
        }
    }

    private function pathFor(string $slug): string
    {
        return $slug === Poll::coreSlug() ? '/tierlist' : '/polls/'.$slug;
    }
}
