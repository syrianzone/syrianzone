<?php

namespace App\Services\Phonebook;

use App\Exceptions\Directories\DirectoryActionException;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The Phonebook directory domain, transport-free.
 *
 * Same shape as SyOfficialDirectoryService and GovAppService, and for the same
 * reason: the four directories share the rules (caller-supplied string ids,
 * `order_column` scoped per category, a cache to forget on every write, the
 * `{orders: [{id, order_column}]}` reorder payload the shared SortableList
 * posts), so the third copy belongs here rather than in its controller. The
 * cache keys stay in PhonebookCache.
 *
 * Validation lives in the caller, matching the other two: the service takes
 * scalars and arrays, never an HTTP Request.
 */
class PhonebookDirectoryService
{
    /**
     * @return Collection<int, PhonebookCategory>
     */
    public function categories(): Collection
    {
        return PhonebookCategory::orderBy('order_column')->get();
    }

    /**
     * @return Collection<int, PhonebookEntry>
     */
    public function entries(): Collection
    {
        return PhonebookEntry::with('category')
            ->orderBy('order_column')
            ->get();
    }

    public function findCategory(string $id): PhonebookCategory
    {
        $category = PhonebookCategory::find($id);

        if ($category === null) {
            throw DirectoryActionException::notFound($id, 'Category');
        }

        return $category;
    }

    public function findEntry(string $id): PhonebookEntry
    {
        $entry = PhonebookEntry::find($id);

        if ($entry === null) {
            throw DirectoryActionException::notFound($id, 'Entry');
        }

        return $entry;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function createCategory(array $attributes): PhonebookCategory
    {
        $attributes['order_column'] = (int) (PhonebookCategory::max('order_column') ?? 0) + 1;
        $attributes['is_active'] = $attributes['is_active'] ?? true;

        $category = PhonebookCategory::create($attributes);

        $this->flushCache();

        return $category;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function updateCategory(string $id, array $attributes): PhonebookCategory
    {
        $category = $this->findCategory($id);

        $category->update($attributes);

        $this->flushCache();

        return $category;
    }

    /**
     * Hard delete. The entries in this category go with it via the foreign
     * key's ON DELETE CASCADE.
     */
    public function deleteCategory(string $id): void
    {
        $this->findCategory($id)->delete();

        $this->flushCache();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function createEntry(array $attributes): PhonebookEntry
    {
        if (empty($attributes['id'])) {
            // ULID keeps the prefix the seeder and client already use, and is
            // unique per millisecond, unlike time() + a three-digit random.
            $attributes['id'] = 'phone_'.Str::ulid();
        }

        $attributes = $this->normalizeOptionalText($attributes);

        $attributes['order_column'] = (int) (PhonebookEntry::where('category_id', $attributes['category_id'])->max('order_column') ?? 0) + 1;
        $attributes['is_active'] = $attributes['is_active'] ?? true;
        $attributes['is_whatsapp'] = $attributes['is_whatsapp'] ?? false;

        $entry = PhonebookEntry::create($attributes);

        $this->flushCache();

        return $entry;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function updateEntry(string $id, array $attributes): PhonebookEntry
    {
        $entry = $this->findEntry($id);

        $entry->update($this->normalizeOptionalText($attributes));

        $this->flushCache();

        return $entry;
    }

    public function toggleEntryActive(string $id): PhonebookEntry
    {
        $entry = $this->findEntry($id);

        $entry->is_active = ! $entry->is_active;
        $entry->save();

        $this->flushCache();

        return $entry;
    }

    public function deleteEntry(string $id): void
    {
        $this->findEntry($id)->delete();

        $this->flushCache();
    }

    /**
     * @param  array<int, array{id: string, order_column: int}>  $orders
     * @return int Number of rows written.
     */
    public function reorderCategories(array $orders): int
    {
        return $this->applyOrder(PhonebookCategory::class, $orders);
    }

    /**
     * @param  array<int, array{id: string, order_column: int}>  $orders
     */
    public function reorderEntries(array $orders): int
    {
        return $this->applyOrder(PhonebookEntry::class, $orders);
    }

    /**
     * @param  array<int, array{id: string, order_column: int}>  $orders
     */
    protected function applyOrder(string $model, array $orders): int
    {
        $written = DB::transaction(function () use ($model, $orders) {
            $count = 0;

            foreach ($orders as $item) {
                $count += $model::where('id', $item['id'])->update([
                    'order_column' => (int) $item['order_column'],
                ]);
            }

            return $count;
        });

        $this->flushCache();

        return $written;
    }

    /**
     * The form submits empty strings for the two optional columns; an empty
     * value is "not set", not an empty string in the table.
     *
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    protected function normalizeOptionalText(array $attributes): array
    {
        foreach (['source_url', 'name_en'] as $field) {
            if (! array_key_exists($field, $attributes)) {
                continue;
            }

            $value = is_string($attributes[$field]) ? trim($attributes[$field]) : '';

            $attributes[$field] = $value === '' ? null : $value;
        }

        return $attributes;
    }

    protected function flushCache(): void
    {
        PhonebookCache::forget();
    }
}
