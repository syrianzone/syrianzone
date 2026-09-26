<?php

namespace App\Http\Middleware;

/**
 * Places moderation admin.
 *
 * @see ModuleCapabilityGuard for why the whole group is no longer granted to
 *      anyone holding a single capability.
 */
class PlacesAdmin extends ModuleCapabilityGuard
{
    public function alias(): string
    {
        return 'places_admin';
    }

    protected function capabilities(): array
    {
        return [
            'places.review',
            'places.approve',
            'places.edit',
            'places.moderate_photos',
            'places.delete',
        ];
    }
}
