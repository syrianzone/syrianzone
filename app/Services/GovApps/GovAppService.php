<?php

namespace App\Services\GovApps;

use App\Exceptions\Directories\DirectoryActionException;
use App\Models\GovApp;
use App\Services\Directories\SquareWebpImageService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * The government-apps directory domain, transport-free.
 *
 * Extracted from GovAppsAdminController so the dashboard and the agent MCP
 * surface share one implementation.
 *
 * Two things differ from SyOfficial and are deliberate, not oversights:
 *
 *  - GovApp soft deletes. A removed app disappears from the admin listing and
 *    the public feed, but the row stays and the id stays taken. Callers must
 *    not assume a deleted id is reusable, and there is no MCP tool that
 *    permanently purges a record.
 *  - The `images` gallery column is only ever seeded empty on create and is
 *    never touched by an update. It is maintained elsewhere, so the agent
 *    surface leaves it alone.
 */
class GovAppService
{
    public const APPS_CACHE_KEY = 'govapps:db_apps_v1';

    public const ICON_DIR = 'govapps';

    public function __construct(private readonly SquareWebpImageService $images) {}

    /**
     * @return Collection<int, GovApp>
     */
    public function apps()
    {
        return GovApp::orderBy('order_column')->get();
    }

    public function find(string $id): GovApp
    {
        $app = GovApp::find($id);

        if ($app === null) {
            throw DirectoryActionException::notFound($id, 'App');
        }

        return $app;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, string>  $links
     */
    public function create(array $attributes, array $links = [], ?UploadedFile $icon = null): GovApp
    {
        $this->assertIdFree($attributes['id'] ?? null);

        $app = new GovApp;
        $app->id = $attributes['id'];
        $app->name = $attributes['name'];
        $app->name_ar = $attributes['name_ar'];
        $app->description = $attributes['description'] ?? null;
        $app->description_ar = $attributes['description_ar'] ?? null;
        $app->icon = $icon !== null
            ? $this->images->storeSquareWebp($icon, self::ICON_DIR, $app->id)
            : null;
        $app->images = [];
        $app->links = $this->filterUrls($links);
        $app->order_column = (int) (GovApp::max('order_column') ?? 0) + 1;
        $app->is_active = $attributes['is_active'] ?? true;

        try {
            $app->save();
        } catch (\Throwable $e) {
            $app->forceDelete();

            throw $e;
        }

        $this->flushCache();

        return $app;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, string>|null  $links  Null leaves the existing list alone.
     */
    public function update(string $id, array $attributes, ?array $links = null, ?UploadedFile $icon = null): GovApp
    {
        $app = $this->find($id);

        $app->name = $attributes['name'] ?? $app->name;
        $app->name_ar = $attributes['name_ar'] ?? $app->name_ar;

        if (array_key_exists('description', $attributes)) {
            $app->description = $attributes['description'];
        }
        if (array_key_exists('description_ar', $attributes)) {
            $app->description_ar = $attributes['description_ar'];
        }
        if ($links !== null) {
            $app->links = $this->filterUrls($links);
        }
        if ($icon !== null) {
            $app->icon = $this->images->storeSquareWebp($icon, self::ICON_DIR, $app->id);
        }

        $app->save();

        $this->flushCache();

        return $app;
    }

    public function setActive(string $id, bool $isActive): GovApp
    {
        $app = $this->find($id);

        $app->is_active = $isActive;
        $app->save();

        $this->flushCache();

        return $app;
    }

    /**
     * Soft delete. The row and its id survive; use restore() to bring it back.
     */
    public function delete(string $id): GovApp
    {
        $app = $this->find($id);

        $app->delete();

        $this->flushCache();

        return $app;
    }

    public function restore(string $id): GovApp
    {
        $app = GovApp::withTrashed()->find($id);

        if ($app === null) {
            throw DirectoryActionException::notFound($id, 'App');
        }

        $app->restore();

        $this->flushCache();

        return $app;
    }

    /**
     * @param  array<int, array{id: string, order_column: int}>  $orders
     * @return int Number of rows written.
     */
    public function reorder(array $orders): int
    {
        $written = DB::transaction(function () use ($orders) {
            $count = 0;

            foreach ($orders as $item) {
                $count += GovApp::where('id', $item['id'])->update([
                    'order_column' => (int) $item['order_column'],
                ]);
            }

            return $count;
        });

        $this->flushCache();

        return $written;
    }

    /**
     * Keep only http(s) links and reindex, so the JSON column stays a list
     * rather than becoming an object with gaps. See the equivalent note in
     * SyOfficialDirectoryService::filterUrls().
     *
     * @param  array<int, mixed>  $urls
     * @return array<int, string>
     */
    protected function filterUrls(array $urls): array
    {
        return array_values(array_filter(
            $urls,
            static function ($url): bool {
                if (! is_string($url)) {
                    return false;
                }

                $url = trim($url);

                return $url !== ''
                    && (str_starts_with($url, 'http://') || str_starts_with($url, 'https://'));
            },
        ));
    }

    protected function assertIdFree(?string $id): void
    {
        if ($id === null || trim($id) === '') {
            throw DirectoryActionException::idRequired();
        }

        // withTrashed() on purpose: a soft-deleted app still owns its id, so
        // reusing it would collide on the unique primary key and only surface
        // as an opaque driver error.
        if (GovApp::withTrashed()->where('id', $id)->exists()) {
            throw DirectoryActionException::idTaken($id, 'App');
        }
    }

    protected function flushCache(): void
    {
        Cache::forget(self::APPS_CACHE_KEY);
    }
}
