<?php

namespace App\Http\Middleware;

/**
 * Government apps admin.
 *
 * @see ModuleCapabilityGuard for why the whole group is no longer granted to
 *      anyone holding a single capability.
 */
class GovAppsAdmin extends ModuleCapabilityGuard
{
    public function alias(): string
    {
        return 'govapps_admin';
    }

    protected function capabilities(): array
    {
        return [
            'govapps.create',
            'govapps.edit',
            'govapps.toggle',
            'govapps.delete',
            'govapps.reorder',
        ];
    }
}
