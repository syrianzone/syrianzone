<?php

namespace App\Http\Middleware;

/**
 * Phonebook directory admin.
 *
 * @see ModuleCapabilityGuard for why the whole group is no longer granted to
 *      anyone holding a single capability.
 */
class PhonebookAdmin extends ModuleCapabilityGuard
{
    public function alias(): string
    {
        return 'phonebook_admin';
    }

    protected function capabilities(): array
    {
        return [
            'phonebook.create',
            'phonebook.edit',
            'phonebook.toggle',
            'phonebook.delete',
            'phonebook.reorder',
        ];
    }
}
