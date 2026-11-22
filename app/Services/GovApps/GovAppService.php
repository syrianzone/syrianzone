<?php

namespace App\Services\GovApps;

use App\Exceptions\Directories\DirectoryActionException;
use App\Models\GovApp;
use App\Services\Directories\SquareWebpImageService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

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
     * @param  array<string, string|null>  $links  Channel key (`official`, `android`, `apple`) => URL.
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
        $app->official_entity_id = $attributes['official_entity_id'] ?? null;
        $app->overview_ar = $attributes['overview_ar'] ?? null;
        $app->features = array_key_exists('features', $attributes) ? $this->filterStringList($attributes['features']) : null;
        $app->requirements = array_key_exists('requirements', $attributes) ? $this->filterStringList($attributes['requirements']) : null;
        $app->faqs = array_key_exists('faqs', $attributes) ? $this->filterFaqs($attributes['faqs']) : null;
        $app->verified_at = $attributes['verified_at'] ?? null;
        if ($icon !== null) {
            $app->icon = $this->images->storeSquareWebp($icon, self::ICON_DIR, $app->id);
        } elseif (! empty($attributes['icon_url']) && is_string($attributes['icon_url'])) {
            $app->icon = $this->storeIconFromUrl($attributes['icon_url'], $app->id);
        } else {
            $app->icon = null;
        }
        $app->images = [];
        $app->links = $this->filterLinkMap($links);
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
     * @param  array<string, string|null>|null  $links  Null leaves the existing map alone.
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
        if (array_key_exists('official_entity_id', $attributes)) {
            $app->official_entity_id = $attributes['official_entity_id'] ?: null;
        }
        if (array_key_exists('overview_ar', $attributes)) {
            $app->overview_ar = $attributes['overview_ar'];
        }
        if (array_key_exists('features', $attributes)) {
            $app->features = $this->filterStringList($attributes['features']);
        }
        if (array_key_exists('requirements', $attributes)) {
            $app->requirements = $this->filterStringList($attributes['requirements']);
        }
        if (array_key_exists('faqs', $attributes)) {
            $app->faqs = $this->filterFaqs($attributes['faqs']);
        }
        if (array_key_exists('verified_at', $attributes)) {
            $app->verified_at = $attributes['verified_at'] ?: null;
        }
        if ($links !== null) {
            $app->links = $this->filterLinkMap($links);
        }
        if ($icon !== null) {
            $app->icon = $this->images->storeSquareWebp($icon, self::ICON_DIR, $app->id);
        } elseif (! empty($attributes['icon_url']) && is_string($attributes['icon_url'])) {
            $stored = $this->storeIconFromUrl($attributes['icon_url'], $app->id);
            if ($stored !== null) {
                $app->icon = $stored;
            }
        }

        $app->save();

        $this->flushCache();

        return $app;
    }

    private function storeIconFromUrl(string $url, string $appId): ?string
    {
        $trimmed = trim($url);
        if (! str_starts_with($trimmed, 'https://') && ! str_starts_with($trimmed, 'http://')) {
            return null;
        }

        $response = Http::timeout(15)
            ->withUserAgent('Mozilla/5.0 (compatible; SyrianZoneBot/1.0)')
            ->get($trimmed);

        if (! $response->successful() || $response->body() === '') {
            return null;
        }

        return $this->images->storeSquareWebpFromBytes($response->body(), self::ICON_DIR, $appId);
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
     * Filter `gov_apps.links`, which is an object keyed by channel (`official`,
     * `android`, `apple`) — both the public directory (`GovAppsClient.tsx`) and
     * the admin edit dialog (`AppDialog.tsx`) read links by those keys.
     *
     * Calling `array_values()` previously stripped those keys into a numeric
     * list `[0 => "https://..."]`, making every saved link disappear from both
     * the public page and the edit dialog on reload. Empty values and non-http
     * URLs are dropped while keeping the channel keys intact; a list is refused.
     *
     * @param  array<array-key, mixed>  $links
     * @return array<string, string>
     */
    protected function filterLinkMap(array $links): array
    {
        if ($links !== [] && array_is_list($links)) {
            throw DirectoryActionException::linksNotKeyed();
        }

        $filtered = [];

        foreach ($links as $channel => $url) {
            if (! is_string($channel) || $channel === '' || ! is_string($url)) {
                continue;
            }

            $trimmed = trim($url);
            if ($trimmed === '' || (! str_starts_with($trimmed, 'http://') && ! str_starts_with($trimmed, 'https://'))) {
                continue;
            }

            $filtered[$channel] = $trimmed;
        }

        return $filtered;
    }

    /**
     * @param  array<array-key, mixed>|null  $items
     * @return array<int, string>|null
     */
    protected function filterStringList(?array $items): ?array
    {
        if ($items === null) {
            return null;
        }

        $clean = [];
        foreach ($items as $item) {
            if (! is_string($item)) {
                continue;
            }
            $trimmed = trim($item);
            if ($trimmed !== '') {
                $clean[] = $trimmed;
            }
        }

        return $clean;
    }

    /**
     * @param  array<array-key, mixed>|null  $faqs
     * @return array<int, array{q: string, a: string}>|null
     */
    protected function filterFaqs(?array $faqs): ?array
    {
        if ($faqs === null) {
            return null;
        }

        $clean = [];
        foreach ($faqs as $faq) {
            if (! is_array($faq)) {
                continue;
            }
            $q = is_string($faq['q'] ?? null) ? trim($faq['q']) : '';
            $a = is_string($faq['a'] ?? null) ? trim($faq['a']) : '';
            if ($q !== '' && $a !== '') {
                $clean[] = ['q' => $q, 'a' => $a];
            }
        }

        return $clean;
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
