<?php

namespace App\Services\SyOfficial;

use App\Exceptions\Directories\DirectoryActionException;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Services\Directories\SquareWebpImageService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * The SyOfficial directory domain, transport-free.
 *
 * Extracted from SyOfficialAdminController so the dashboard and the agent MCP
 * surface run the same rules instead of two copies drifting. The rules that
 * must not be relaxed:
 *
 *  - Category ids and entity ids are caller-supplied slugs, unique per table.
 *  - An entity's order_column is scoped to its category, not the table.
 *  - Deleting a category cascades to its entities at the database level. That is
 *    destructive and silent, so callers are expected to warn about it.
 *  - Any write forgets both public read caches, which are cached for 600s.
 *
 * Validation lives in the callers (controller and tool), matching the places
 * precedent: the service takes scalars and arrays, never an HTTP Request.
 */
class SyOfficialDirectoryService
{
    public const CATEGORIES_CACHE_KEY = 'syofficial:db_categories_v2';

    public const ENTITIES_CACHE_KEY = 'syofficial:db_entities_v2';

    public const IMAGE_DIR = 'syofficial/entities';

    public const PLACEHOLDER_IMAGE = 'images/governorates/placeholder.webp';

    public function __construct(private readonly SquareWebpImageService $images) {}

    /**
     * @return Collection<int, OfficialCategory>
     */
    public function categories()
    {
        return OfficialCategory::orderBy('order_column')->get();
    }

    /**
     * @return Collection<int, OfficialEntity>
     */
    public function entities()
    {
        return OfficialEntity::with('category')->orderBy('order_column')->get();
    }

    public function findCategory(string $id): OfficialCategory
    {
        $category = OfficialCategory::find($id);

        if ($category === null) {
            throw DirectoryActionException::notFound($id, 'Category');
        }

        return $category;
    }

    public function findEntity(string $id): OfficialEntity
    {
        $entity = OfficialEntity::with('category')->find($id);

        if ($entity === null) {
            throw DirectoryActionException::notFound($id, 'Entity');
        }

        return $entity;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function createCategory(array $attributes): OfficialCategory
    {
        $this->assertIdFree(OfficialCategory::class, $attributes['id'] ?? null);

        $attributes['order_column'] = (int) (OfficialCategory::max('order_column') ?? 0) + 1;
        $attributes['is_active'] = $attributes['is_active'] ?? true;

        $category = OfficialCategory::create($attributes);

        $this->flushCache();

        return $category;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function updateCategory(string $id, array $attributes): OfficialCategory
    {
        $category = $this->findCategory($id);

        $category->update($attributes);

        $this->flushCache();

        return $category;
    }

    public function setCategoryActive(string $id, bool $isActive): OfficialCategory
    {
        return $this->updateCategory($id, ['is_active' => $isActive]);
    }

    /**
     * Hard delete. The entities in this category go with it via the foreign
     * key's ON DELETE CASCADE, so report the count before calling.
     */
    public function deleteCategory(string $id): int
    {
        $category = $this->findCategory($id);

        $entityCount = OfficialEntity::where('category_id', $id)->count();

        $category->delete();

        $this->flushCache();

        return $entityCount;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, string>  $socials  Platform key => URL.
     */
    public function createEntity(array $attributes, array $socials = [], ?UploadedFile $image = null): OfficialEntity
    {
        $this->assertIdFree(OfficialEntity::class, $attributes['id'] ?? null);

        $categoryId = $attributes['category_id'];
        $this->assertCategoryExists($categoryId);

        $entity = new OfficialEntity;
        $entity->id = $attributes['id'];
        $entity->category_id = $categoryId;
        $entity->name = $attributes['name'];
        $entity->name_ar = $attributes['name_ar'];
        $entity->description = $attributes['description'] ?? null;
        $entity->description_ar = $attributes['description_ar'] ?? null;
        $entity->socials = $this->filterSocialMap($socials);
        $entity->is_active = $attributes['is_active'] ?? true;
        $entity->order_column = (int) (OfficialEntity::where('category_id', $categoryId)->max('order_column') ?? 0) + 1;
        $entity->image = $image !== null
            ? $this->images->storeSquareWebp($image, self::IMAGE_DIR, $entity->id)
            : self::PLACEHOLDER_IMAGE;

        // Wrapped so a failure after the upload does not leave an orphaned file
        // referenced by nothing: the row is what makes the image reachable.
        try {
            $entity->save();
        } catch (\Throwable $e) {
            $entity->delete();

            throw $e;
        }

        $this->flushCache();

        return $entity;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, string>|null  $socials  Null leaves the existing map alone.
     */
    public function updateEntity(string $id, array $attributes, ?array $socials = null, ?UploadedFile $image = null): OfficialEntity
    {
        $entity = $this->findEntity($id);

        if (array_key_exists('category_id', $attributes)) {
            $this->assertCategoryExists($attributes['category_id']);
        }

        $entity->name = $attributes['name'] ?? $entity->name;
        $entity->name_ar = $attributes['name_ar'] ?? $entity->name_ar;

        if (array_key_exists('description', $attributes)) {
            $entity->description = $attributes['description'];
        }
        if (array_key_exists('description_ar', $attributes)) {
            $entity->description_ar = $attributes['description_ar'];
        }
        if ($socials !== null) {
            $entity->socials = $this->filterSocialMap($socials);
        }
        if ($image !== null) {
            // The previous file is intentionally left in place: the column only
            // ever points at the current one, and other rows may share nothing
            // but an R2 lifecycle policy should own the orphan.
            $entity->image = $this->images->storeSquareWebp($image, self::IMAGE_DIR, $entity->id);
        }

        $entity->save();

        $this->flushCache();

        return $entity;
    }

    public function setEntityActive(string $id, bool $isActive): OfficialEntity
    {
        $entity = $this->findEntity($id);

        $entity->is_active = $isActive;
        $entity->save();

        $this->flushCache();

        return $entity;
    }

    public function deleteEntity(string $id): void
    {
        $this->findEntity($id)->delete();

        $this->flushCache();
    }

    /**
     * Apply a caller-supplied ordering. ids are validated to exist, matching the
     * dashboard's rule; the caller is trusted for the ordinal values themselves.
     *
     * @param  array<int, array{id: string, order_column: int}>  $orders
     * @return int Number of rows written.
     */
    public function reorderCategories(array $orders): int
    {
        return $this->applyOrder(OfficialCategory::class, $orders);
    }

    /**
     * @param  array<int, array{id: string, order_column: int}>  $orders
     */
    public function reorderEntities(array $orders): int
    {
        return $this->applyOrder(OfficialEntity::class, $orders);
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
     * The backstop for a URL that reaches a column: callers validate, but an
     * empty string, a bare "http://" or a `javascript:` URL must never be
     * stored.
     */
    private static function isHttpUrl(mixed $url): bool
    {
        if (! is_string($url)) {
            return false;
        }

        $url = trim($url);

        return $url !== ''
            && (str_starts_with($url, 'http://') || str_starts_with($url, 'https://'));
    }

    /**
     * The filter for `official_entities.socials`, which is an object keyed by
     * platform (`{"facebook": "https://…"}`) — the readers resolve the icon and
     * the label from that key, so the keys are the data, not decoration. Empty
     * values and non-http links drop out; the platform keys stay.
     *
     * A list is refused rather than stored: it cannot say which platform each
     * link belongs to, and the next edit of that entity (whose form reads the
     * map by key) would submit an empty map and lose every link.
     *
     * This is deliberately *not* the list helper GovAppService keeps for
     * `gov_apps.links`, where a list is the right shape: copying that one here
     * is what flattened the column in the first place.
     *
     * @param  array<array-key, mixed>  $socials
     * @return array<string, string>
     */
    protected function filterSocialMap(array $socials): array
    {
        if ($socials !== [] && array_is_list($socials)) {
            throw DirectoryActionException::socialsNotKeyed();
        }

        $filtered = [];

        foreach ($socials as $platform => $url) {
            if (! is_string($platform) || $platform === '' || ! self::isHttpUrl($url)) {
                continue;
            }

            $filtered[$platform] = trim((string) $url);
        }

        return $filtered;
    }

    /**
     * @param  class-string  $model
     */
    protected function assertIdFree(string $model, ?string $id): void
    {
        if ($id === null || trim($id) === '') {
            throw DirectoryActionException::idRequired();
        }

        if ($model::where('id', $id)->exists()) {
            throw DirectoryActionException::idTaken($id);
        }
    }

    protected function assertCategoryExists(string $categoryId): void
    {
        if (! OfficialCategory::where('id', $categoryId)->exists()) {
            throw DirectoryActionException::categoryNotFound($categoryId);
        }
    }

    protected function flushCache(): void
    {
        Cache::forget(self::CATEGORIES_CACHE_KEY);
        Cache::forget(self::ENTITIES_CACHE_KEY);
    }
}
