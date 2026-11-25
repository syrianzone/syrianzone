<?php

namespace App\Observers\IndexNow;

use App\Models\Place;
use App\Services\IndexNow\IndexNow;

class PlaceObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(Place $place): void
    {
        if ($place->status === 'approved') {
            $this->indexNow->queue('/mishwar');
        }
    }

    public function updated(Place $place): void
    {
        $isApproved = $place->status === 'approved';
        $wasApproved = $place->getOriginal('status') === 'approved';

        if ($isApproved || $wasApproved) {
            $this->indexNow->queue('/mishwar');
        }
    }

    public function deleted(Place $place): void
    {
        if ($place->status === 'approved') {
            $this->indexNow->queue('/mishwar');
        }
    }
}
