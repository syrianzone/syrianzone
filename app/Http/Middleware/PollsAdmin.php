<?php

namespace App\Http\Middleware;

/**
 * Polls admin: create / edit / delete.
 *
 * @see ModuleCapabilityGuard for why the whole group is no longer granted to
 *      anyone holding a single capability.
 */
class PollsAdmin extends ModuleCapabilityGuard
{
    public function alias(): string
    {
        return 'polls_admin';
    }

    protected function capabilities(): array
    {
        return [
            'polls.create',
            'polls.edit',
            'polls.delete',
        ];
    }
}
