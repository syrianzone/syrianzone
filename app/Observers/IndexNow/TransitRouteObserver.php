<?php

namespace App\Observers\IndexNow;

use App\Models\City;
use App\Models\Route as TransitRoute;
use App\Services\IndexNow\IndexNow;

class TransitRouteObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(TransitRoute $route): void
    {
        if ($route->status === 'published') {
            $this->queueCities([$route->city_id]);
        }
    }

    public function updated(TransitRoute $route): void
    {
        $isPublished = $route->status === 'published';
        $wasPublished = $route->getOriginal('status') === 'published';

        if (! $isPublished && ! $wasPublished) {
            return;
        }

        $this->queueCities([
            $route->city_id,
            $route->getOriginal('city_id'),
        ]);
    }

    public function deleted(TransitRoute $route): void
    {
        if ($route->status === 'published') {
            $this->queueCities([$route->city_id]);
        }
    }

    /**
     * @param  array<int, string|null>  $rawCityIds
     */
    private function queueCities(array $rawCityIds): void
    {
        $cityIds = array_values(array_unique(array_filter($rawCityIds)));
        if ($cityIds === []) {
            return;
        }

        $paths = City::where('status', 'active')
            ->whereIn('id', $cityIds)
            ->pluck('id')
            ->map(fn (string $id): string => '/transit/city/'.$id)
            ->all();

        if ($paths !== []) {
            $this->indexNow->queue($paths);
        }
    }
}
