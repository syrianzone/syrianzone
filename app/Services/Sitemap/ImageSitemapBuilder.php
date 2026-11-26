<?php

namespace App\Services\Sitemap;

use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\OfficialEntity;
use App\Models\Promise;
use App\Services\Governorates\GovernorateDataService;
use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Support\Facts;
use Illuminate\Database\Eloquent\Collection;

/**
 * Collects indexable public pages alongside the record images actually
 * rendered in their HTML, structured as small per-source methods so new
 * image sources can be added independently.
 */
class ImageSitemapBuilder
{
    /**
     * @return list<ImageSitemapUrl>
     */
    public function build(): array
    {
        $byPath = [];

        foreach ($this->sources() as $entries) {
            foreach ($entries as $entry) {
                if ($entry->images === []) {
                    continue;
                }

                $existing = $byPath[$entry->path] ?? [];
                $byPath[$entry->path] = array_values(array_unique(array_merge($existing, $entry->images)));
            }
        }

        $result = [];
        foreach ($byPath as $path => $images) {
            if ($images !== []) {
                $result[] = new ImageSitemapUrl($path, $images);
            }
        }

        return $result;
    }

    /**
     * @return list<list<ImageSitemapUrl>>
     */
    private function sources(): array
    {
        return [
            $this->officialImages(),
            $this->govAppDetailImages(),
            $this->govAppIndexImages(),
            $this->promiseDetailImages(),
            $this->promiseIndexImages(),
            $this->syOfficialImages(),
            $this->ramadanImages(),
            $this->currencyImages(),
            $this->governorateIconImages(),
        ];
    }

    /**
     * The SANA photo on each Ramadan city page (`/muslim/ramadan/{id}`); the
     * hub shows all of them on its city cards.
     *
     * @return list<ImageSitemapUrl>
     */
    private function ramadanImages(): array
    {
        $governorateIds = array_map(
            fn (array $gov) => (string) ($gov['id'] ?? ''),
            Facts::governorates(),
        );

        $entries = [];
        $all = [];
        foreach (Facts::ramadanImages() as $id => $image) {
            $file = $this->normalizeImage($image['file'] ?? null, false);
            if ($file === null || ! in_array((string) $id, $governorateIds, true)) {
                continue;
            }
            $entries[] = new ImageSitemapUrl('/muslim/ramadan/'.$id, [$file]);
            $all[] = $file;
        }

        if ($all !== []) {
            $entries[] = new ImageSitemapUrl('/muslim/ramadan', array_values(array_unique($all)));
        }

        return $entries;
    }

    /**
     * Banknote images on `/currency`. Only the front faces are in the
     * server-rendered gallery; backs appear on a toggle, so they are left out.
     *
     * @return list<ImageSitemapUrl>
     */
    private function currencyImages(): array
    {
        $data = Facts::currency();
        $images = [];

        foreach (['new_denominations', 'old_denominations'] as $group) {
            foreach ($data[$group] ?? [] as $note) {
                $front = $this->normalizeImage($note['front_image']['path'] ?? null, false);
                if ($front !== null) {
                    $images[] = $front;
                }
            }
        }

        return $images === [] ? [] : [new ImageSitemapUrl('/currency', array_values(array_unique($images)))];
    }

    /**
     * Governorate landmark icons rendered on `/governorates` and `/governorates/{id}`.
     *
     * @return list<ImageSitemapUrl>
     */
    private function governorateIconImages(): array
    {
        $entries = [];
        $all = [];

        foreach (GovernorateDataService::allIconPaths() as $id => $rawPath) {
            $file = $this->normalizeImage($rawPath, false);
            if ($file === null) {
                continue;
            }
            $entries[] = new ImageSitemapUrl('/governorates/'.$id, [$file]);
            $all[] = $file;
        }

        if ($all !== []) {
            $entries[] = new ImageSitemapUrl('/governorates', array_values(array_unique($all)));
        }

        return $entries;
    }

    /**
     * Published government official profiles (`/govtcvs/{slug}`).
     *
     * @return list<ImageSitemapUrl>
     */
    private function officialImages(): array
    {
        $entries = [];

        $officials = GovtOfficial::published()
            ->with([
                'officialEntity',
                'candidate',
                'promiseSpeaker.candidate',
                'promiseSpeaker.officialEntity',
            ])
            ->orderBy('slug')
            ->get();

        foreach ($officials as $official) {
            if (! filled($official->slug)) {
                continue;
            }

            $portrait = $this->normalizeImage($official->resolvedPortrait(), allowBareEntityFilename: true);
            if ($portrait === null) {
                continue;
            }

            $entries[] = new ImageSitemapUrl('/govtcvs/'.$official->slug, [$portrait]);
        }

        return $entries;
    }

    /**
     * Government apps with a rich guide (`/govapps/{id}`), matching the main sitemap.
     *
     * @return list<ImageSitemapUrl>
     */
    private function govAppDetailImages(): array
    {
        $entries = [];

        $apps = GovApp::query()
            ->where('is_active', true)
            ->whereNotNull('overview_ar')
            ->orderBy('order_column')
            ->get()
            ->filter(fn (GovApp $app): bool => $app->hasRichGuide());

        foreach ($apps as $app) {
            $rawImages = [$app->icon];
            if (is_array($app->images)) {
                array_push($rawImages, ...$app->images);
            }

            $images = $this->normalizeList($rawImages, allowBareEntityFilename: false);
            if ($images === []) {
                continue;
            }

            $entries[] = new ImageSitemapUrl('/govapps/'.$app->id, $images);
        }

        return $entries;
    }

    /**
     * Active government app icons rendered on the `/govapps` directory index.
     *
     * @return list<ImageSitemapUrl>
     */
    private function govAppIndexImages(): array
    {
        $rawIcons = GovApp::query()
            ->where('is_active', true)
            ->orderBy('order_column')
            ->pluck('icon')
            ->all();

        $images = $this->normalizeList($rawIcons, allowBareEntityFilename: false);

        return $images === [] ? [] : [new ImageSitemapUrl('/govapps', $images)];
    }

    /**
     * Published promises (`/promises/{number}`) with speaker and co-speaker portraits.
     *
     * @return list<ImageSitemapUrl>
     */
    private function promiseDetailImages(): array
    {
        $entries = [];

        foreach ($this->publishedPromises() as $promise) {
            $images = $this->normalizeList($this->promiseSpeakerImages($promise), allowBareEntityFilename: true);
            if ($images === []) {
                continue;
            }

            $entries[] = new ImageSitemapUrl('/promises/'.$promise->number, $images);
        }

        return $entries;
    }

    /**
     * Speaker portraits rendered across cards on `/promises`.
     *
     * @return list<ImageSitemapUrl>
     */
    private function promiseIndexImages(): array
    {
        $rawImages = [];

        foreach ($this->publishedPromises() as $promise) {
            array_push($rawImages, ...$this->promiseSpeakerImages($promise));
        }

        $images = $this->normalizeList($rawImages, allowBareEntityFilename: true);

        return $images === [] ? [] : [new ImageSitemapUrl('/promises', $images)];
    }

    /**
     * @return Collection<int, Promise>
     */
    private function publishedPromises()
    {
        return Promise::published()
            ->with([
                'speaker.candidate',
                'speaker.officialEntity',
                'coSpeakerRows.speaker.candidate',
                'coSpeakerRows.speaker.officialEntity',
            ])
            ->orderBy('number')
            ->get();
    }

    /**
     * @return list<?string>
     */
    private function promiseSpeakerImages(Promise $promise): array
    {
        $images = [$promise->speaker?->resolvedImage()];
        foreach ($promise->coSpeakerRows as $coSpeakerRow) {
            $images[] = $coSpeakerRow->speaker?->resolvedImage();
        }

        return $images;
    }

    /**
     * Active official directory entity logos/portraits rendered on `/syofficial`.
     *
     * @return list<ImageSitemapUrl>
     */
    private function syOfficialImages(): array
    {
        $rawImages = OfficialEntity::query()
            ->where('is_active', true)
            ->whereHas('category', fn ($q) => $q->where('is_active', true))
            ->orderBy('order_column')
            ->pluck('image')
            ->all();

        $images = $this->normalizeList($rawImages, allowBareEntityFilename: true);

        return $images === [] ? [] : [new ImageSitemapUrl('/syofficial', $images)];
    }

    /**
     * @param  array<int, mixed>  $rawImages
     * @return list<string>
     */
    private function normalizeList(array $rawImages, bool $allowBareEntityFilename): array
    {
        $normalized = [];

        foreach ($rawImages as $raw) {
            if (! is_string($raw)) {
                continue;
            }

            $image = $this->normalizeImage($raw, $allowBareEntityFilename);
            if ($image !== null) {
                $normalized[] = $image;
            }
        }

        return array_values(array_unique($normalized));
    }

    private function normalizeImage(?string $raw, bool $allowBareEntityFilename): ?string
    {
        $trimmed = trim((string) $raw);
        if ($trimmed === '') {
            return null;
        }

        if (preg_match('/^(data|blob|javascript):/i', $trimmed) === 1) {
            return null;
        }

        $pathOnly = (string) (parse_url($trimmed, PHP_URL_PATH) ?? $trimmed);
        $basename = strtolower(basename($pathOnly));
        if ($basename === '' || str_starts_with($basename, 'placeholder')) {
            return null;
        }

        if (str_starts_with($trimmed, '//')) {
            return 'https:'.$trimmed;
        }

        if (preg_match('#^https?://#i', $trimmed) === 1) {
            return $trimmed;
        }

        if (str_starts_with($trimmed, '/')) {
            return $trimmed;
        }

        if ($allowBareEntityFilename) {
            return $this->mediaBase().'/'.SyOfficialDirectoryService::IMAGE_DIR.'/'.rawurlencode(basename($trimmed));
        }

        return '/'.ltrim($trimmed, '/');
    }

    private function mediaBase(): string
    {
        $r2Url = env('R2_PUBLIC_URL')
            ?: (config('filesystems.disks.r2.url') ?: Facts::media()['public_base']);

        return rtrim((string) $r2Url, '/');
    }
}
