<?php

namespace App\Http\Middleware;

/**
 * SyOfficial directory admin.
 *
 * @see ModuleCapabilityGuard for why the whole group is no longer granted to
 *      anyone holding a single capability.
 */
class SyOfficialAdmin extends ModuleCapabilityGuard
{
    public function alias(): string
    {
        return 'syofficial_admin';
    }

    protected function capabilities(): array
    {
        return [
            'syofficial.create',
            'syofficial.edit',
            'syofficial.toggle',
            'syofficial.delete',
            'syofficial.reorder',
        ];
    }
}
