<?php

namespace App\Services\Phonebook;

use Illuminate\Support\Facades\Cache;

/**
 * The public phonebook feed's cache entries.
 *
 * The categories and the entries are read and invalidated together, so one
 * class holds both keys and one call drops them; no controller has to know the
 * other's key.
 */
final class PhonebookCache
{
    public const CATEGORIES_KEY = 'phonebook:db_categories_v1';

    public const ENTRIES_KEY = 'phonebook:db_entries_v1';

    public static function forget(): void
    {
        Cache::forget(self::CATEGORIES_KEY);
        Cache::forget(self::ENTRIES_KEY);
    }
}
