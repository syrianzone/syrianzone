<?php

namespace App\Http\Middleware;

/**
 * Compass admin: view anonymised statistics for the compass test.
 *
 * @see ModuleCapabilityGuard for why every route in the group must name the
 *      capability it needs rather than granting the whole module.
 */
class CompassAdmin extends ModuleCapabilityGuard
{
    public function alias(): string
    {
        return 'compass_admin';
    }

    protected function capabilities(): array
    {
        return [
            'compass.stats',
            'compass.figures',
            'compass.personas',
        ];
    }
}
