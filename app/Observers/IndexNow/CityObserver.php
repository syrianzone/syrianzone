<?php

namespace App\Observers\IndexNow;

use App\Models\City;
use App\Services\IndexNow\IndexNow;

class CityObserver
{
    public function __construct(private readonly IndexNow $indexNow) {}

    public function created(City $city): void
    {
        if ($city->status === 'active' && $city->routes()->where('status', 'published')->exists()) {
            $this->indexNow->queue('/transit/city/'.$city->id);
        }
    }

    public function updated(City $city): void
    {
        $isActive = $city->status === 'active';
        $wasActive = $city->getOriginal('status') === 'active';

        if (! $isActive && ! $wasActive) {
            return;
        }

        if ($city->routes()->where('status', 'published')->exists()) {
            $this->indexNow->queue('/transit/city/'.$city->id);
        }
    }

    public function deleted(City $city): void
    {
        if ($city->status === 'active') {
            $this->indexNow->queue('/transit/city/'.$city->id);
        }
    }
}
