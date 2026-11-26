<?php

namespace App\Observers\IndexNow;

use App\Models\Promise;
use App\Services\IndexNow\IndexNow;

class PromiseObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(Promise $promise): void
    {
        if ($promise->review_status === 'published' && $promise->number !== null) {
            $this->indexNow->queue([
                '/promises/'.$promise->number,
                '/promises',
            ]);
        }
    }

    public function updated(Promise $promise): void
    {
        $paths = [];

        if ($promise->review_status === 'published' && $promise->number !== null) {
            $paths[] = '/promises/'.$promise->number;
            $paths[] = '/promises';
        }

        if ($promise->getOriginal('review_status') === 'published'
            && $promise->getOriginal('number') !== null) {
            $paths[] = '/promises/'.$promise->getOriginal('number');
            $paths[] = '/promises';
        }

        if ($paths !== []) {
            $this->indexNow->queue($paths);
        }
    }

    public function deleted(Promise $promise): void
    {
        if ($promise->review_status === 'published' && $promise->number !== null) {
            $this->indexNow->queue([
                '/promises/'.$promise->number,
                '/promises',
            ]);
        }
    }
}
