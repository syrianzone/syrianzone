<?php

namespace App\Services\Phonebook;

use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use Illuminate\Database\Eloquent\Collection;
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

    /**
     * @return Collection<int, PhonebookCategory>
     */
    public static function categories(): Collection
    {
        return Cache::remember(self::CATEGORIES_KEY, 600, function () {
            self::ensureSeeded();

            return PhonebookCategory::where('is_active', true)
                ->orderBy('order_column')
                ->get();
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function entries(): array
    {
        return Cache::remember(self::ENTRIES_KEY, 600, function () {
            self::ensureSeeded();

            return PhonebookEntry::with('category')
                ->where('is_active', true)
                ->whereHas('category', fn ($q) => $q->where('is_active', true))
                ->orderBy('order_column')
                ->get()
                ->map(fn (PhonebookEntry $item) => [
                    'id' => $item->id,
                    'category_id' => $item->category_id,
                    'category_ar' => $item->category?->label_ar ?? '',
                    'category_en' => $item->category?->label_en ?? '',
                    'name_ar' => $item->name_ar,
                    'name_en' => $item->name_en ?? '',
                    'number' => $item->number,
                    'is_whatsapp' => (bool) $item->is_whatsapp,
                    'source_url' => $item->source_url ?? '',
                ])
                ->values()
                ->all();
        });
    }

    /**
     * Seed an empty directory on first use. Checked inside the cached read so a
     * warm page does not count the table on every hit, and shared across Web,
     * JSON API, and MCP so an unseeded DB never poisons the shared cache keys.
     */
    private static function ensureSeeded(): void
    {
        if (PhonebookCategory::count() === 0) {
            try {
                (new \Database\Seeders\PhonebookSeeder)->run();
            } catch (\Throwable) {
            }
        }
    }

    public static function forget(): void
    {
        Cache::forget(self::CATEGORIES_KEY);
        Cache::forget(self::ENTRIES_KEY);
    }
}
