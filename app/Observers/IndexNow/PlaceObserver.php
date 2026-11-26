<?php

namespace App\Observers\IndexNow;

use App\Models\Place;
use App\Services\IndexNow\IndexNow;
use App\Services\Places\PlaceGovernorates;

class PlaceObserver
{
    public function __construct(
        private readonly IndexNow $indexNow,
        private readonly PlaceGovernorates $governorates,
    ) {}

    public function created(Place $place): void
    {
        if ($place->status === 'approved') {
            PlaceGovernorates::forget();
            $this->indexNow->queue(['/mishwar', ...$this->hubPaths($place)]);
        }
    }

    public function updated(Place $place): void
    {
        $isApproved = $place->status === 'approved';
        $wasApproved = $place->getOriginal('status') === 'approved';

        if ($isApproved || $wasApproved) {
            PlaceGovernorates::forget();
            $this->indexNow->queue(['/mishwar', ...$this->hubPaths($place)]);
        }
    }

    public function deleted(Place $place): void
    {
        if ($place->status === 'approved') {
            PlaceGovernorates::forget();
            $this->indexNow->queue(['/mishwar', ...$this->hubPaths($place)]);
        }
    }

    /**
     * Governorate and category hub paths affected by this place.
     *
     * @return list<string>
     */
    private function hubPaths(Place $place): array
    {
        $paths = [];
        $gov = $this->governorates->forPlace($place);
        if ($gov !== null) {
            $paths[] = '/mishwar/'.$gov;
            foreach (array_unique([$place->category, $place->getOriginal('category')]) as $category) {
                if (is_string($category) && $category !== '' && $category !== 'other') {
                    $paths[] = '/mishwar/'.$gov.'/'.$category;
                }
            }
        }

        return $paths;
    }
}
