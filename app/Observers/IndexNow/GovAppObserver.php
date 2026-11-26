<?php

namespace App\Observers\IndexNow;

use App\Models\GovApp;
use App\Services\IndexNow\IndexNow;

class GovAppObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(GovApp $app): void
    {
        if ((bool) $app->is_active && $app->hasRichGuide()) {
            $this->indexNow->queue([
                '/govapps/'.$app->id,
                '/govapps',
            ]);
        }
    }

    public function updated(GovApp $app): void
    {
        $isPublic = (bool) $app->is_active && $app->hasRichGuide();
        $wasPublic = $this->wasRichGuide($app);

        if ($isPublic || $wasPublic) {
            $this->indexNow->queue([
                '/govapps/'.$app->id,
                '/govapps',
            ]);
        }
    }

    public function deleted(GovApp $app): void
    {
        if ((bool) $app->is_active && $app->hasRichGuide()) {
            $this->indexNow->queue([
                '/govapps/'.$app->id,
                '/govapps',
            ]);
        }
    }

    private function wasRichGuide(GovApp $app): bool
    {
        if (! (bool) $app->getOriginal('is_active') || ! filled($app->getOriginal('overview_ar'))) {
            return false;
        }

        $features = $app->getOriginal('features');
        if (is_string($features)) {
            $features = json_decode($features, true);
        }

        return is_array($features) && count($features) >= 3;
    }
}
