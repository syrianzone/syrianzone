<?php

namespace App\Observers\IndexNow;

use App\Models\Place;
use App\Services\IndexNow\IndexNow;
use App\Services\Places\PlaceIndexability;
use App\Services\Places\PlaceUrls;

class PlaceObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(Place $place): void
    {
        if ($place->status !== 'approved') {
            return;
        }

        $paths = ['/mishwar'];
        if (PlaceIndexability::isIndexable($place)) {
            array_unshift($paths, $place->publicPath());
        }

        $this->indexNow->queue($paths);
    }

    public function updated(Place $place): void
    {
        $isApproved = $place->status === 'approved';
        $wasApproved = $place->getOriginal('status') === 'approved';

        if (! $isApproved && ! $wasApproved) {
            return;
        }

        $paths = [];
        $photoCount = PlaceIndexability::photoCount($place);
        $isIndexable = $isApproved && ! PlaceIndexability::isThin($place, $photoCount);
        $wasIndexable = $wasApproved
            && ! PlaceIndexability::isThinContent((string) $place->getOriginal('description'), $photoCount);

        if ($isIndexable || $wasIndexable) {
            $currentPath = $place->publicPath();
            $paths[] = $currentPath;

            $originalName = (string) $place->getOriginal('name');
            if ($originalName !== '' && $originalName !== (string) $place->name) {
                $oldPath = PlaceUrls::path((int) $place->id, $originalName);
                if ($oldPath !== $currentPath) {
                    $paths[] = $oldPath;
                }
            }
        }

        $paths[] = '/mishwar';

        $this->indexNow->queue($paths);
    }

    public function deleted(Place $place): void
    {
        if ($place->status !== 'approved') {
            return;
        }

        $paths = ['/mishwar'];
        if (PlaceIndexability::isIndexable($place)) {
            array_unshift($paths, $place->publicPath());
        }

        $this->indexNow->queue($paths);
    }
}
