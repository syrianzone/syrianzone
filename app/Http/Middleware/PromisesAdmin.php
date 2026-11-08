<?php

namespace App\Http\Middleware;

use App\Support\Permissions\PermissionCatalogue;

/**
 * Promises tracker admin: promises, the review queue, speakers and sectors.
 *
 * @see ModuleCapabilityGuard for why every route in the group must name the
 *      capability it needs rather than granting the whole module.
 */
class PromisesAdmin extends ModuleCapabilityGuard
{
    public function alias(): string
    {
        return 'promises_admin';
    }

    protected function capabilities(): array
    {
        return PermissionCatalogue::forModule('promises');
    }
}
