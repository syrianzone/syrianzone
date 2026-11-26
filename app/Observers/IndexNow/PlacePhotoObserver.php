<?php

namespace App\Observers\IndexNow;

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\IndexNow\IndexNow;
use App\Services\Places\PlaceIndexability;

class PlacePhotoObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(PlacePhoto $photo): void
    {
        $place = $this->approvedPlace($photo);
        if ($place === null) {
            return;
        }

        if (PlaceIndexability::isIndexable($place)) {
            $this->indexNow->queue($place->publicPath());
        }
    }

    public function updated(PlacePhoto $photo): void
    {
        $place = $this->approvedPlace($photo);
        if ($place === null) {
            return;
        }

        if (PlaceIndexability::isIndexable($place)) {
            $this->indexNow->queue($place->publicPath());
        }
    }

    public function deleted(PlacePhoto $photo): void
    {
        $place = $this->approvedPlace($photo);
        if ($place === null) {
            return;
        }

        // Queue when still indexable OR when dropping this photo made it thin (noindex).
        $remainingPhotos = $place->photos()->count();
        if (PlaceIndexability::isIndexable($place, $remainingPhotos)
            || PlaceIndexability::isIndexable($place, $remainingPhotos + 1)) {
            $this->indexNow->queue($place->publicPath());
        }
    }

    private function approvedPlace(PlacePhoto $photo): ?Place
    {
        $place = Place::whereKey($photo->place_id)
            ->where('status', 'approved')
            ->first(['id', 'name', 'description', 'status']);

        return $place instanceof Place ? $place : null;
    }
}
