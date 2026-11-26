<?php

namespace App\Observers\IndexNow;

use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Services\IndexNow\IndexNow;

class GovtTenureObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(GovtTenure $tenure): void
    {
        $this->queueForOfficial($tenure->official_id);
    }

    public function updated(GovtTenure $tenure): void
    {
        $this->queueForOfficial($tenure->official_id);

        $previousOfficialId = $tenure->getOriginal('official_id');
        if ($previousOfficialId && $previousOfficialId !== $tenure->official_id) {
            $this->queueForOfficial($previousOfficialId);
        }
    }

    public function deleted(GovtTenure $tenure): void
    {
        $this->queueForOfficial($tenure->official_id);
    }

    private function queueForOfficial(?string $officialId): void
    {
        if (! $officialId) {
            return;
        }

        $official = GovtOfficial::published()
            ->whereKey($officialId)
            ->first(['id', 'slug', 'publish_status']);

        if ($official && filled($official->slug)) {
            $this->indexNow->queue([
                '/govtcvs/'.$official->slug,
                '/govtcvs',
                '/govtcvs/movements',
            ]);
        }
    }
}
