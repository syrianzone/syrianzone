<?php

namespace App\Observers\IndexNow;

use App\Models\GovtOfficial;
use App\Services\IndexNow\IndexNow;

class GovtOfficialObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(GovtOfficial $official): void
    {
        if ($official->publish_status === 'published' && filled($official->slug)) {
            $this->indexNow->queue([
                '/govtcvs/'.$official->slug,
                '/govtcvs',
                '/govtcvs/movements',
            ]);
        }
    }

    public function updated(GovtOfficial $official): void
    {
        $paths = [];

        if ($official->publish_status === 'published' && filled($official->slug)) {
            $paths = ['/govtcvs/'.$official->slug, '/govtcvs', '/govtcvs/movements'];
        }

        if ($official->getOriginal('publish_status') === 'published'
            && filled($official->getOriginal('slug'))) {
            $paths[] = '/govtcvs/'.$official->getOriginal('slug');
            $paths[] = '/govtcvs';
            $paths[] = '/govtcvs/movements';
        }

        if ($paths !== []) {
            $this->indexNow->queue($paths);
        }
    }

    public function deleted(GovtOfficial $official): void
    {
        if ($official->publish_status === 'published' && filled($official->slug)) {
            $this->indexNow->queue([
                '/govtcvs/'.$official->slug,
                '/govtcvs',
                '/govtcvs/movements',
            ]);
        }
    }
}
