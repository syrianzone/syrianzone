<?php

namespace App\Console\Commands;

use App\Models\WildlifeSpecies;
use App\Services\Wildlife\WildlifeEditor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Copies the wildlife guide's photos from Wikimedia Commons to the R2 media
 * store, so pages stop hotlinking Commons and share cards can draw them
 * (Commons is not an allowed card-image host). Each photo is stored at every
 * width the pages request (IMAGE_WIDTHS in `Domain/wildlife/wildlife.ts`): the
 * largest at `wildlife/{slug}-{source}.jpg`, the key the data records, and the
 * others beside it as `wildlife/{slug}-{source}-{width}.jpg`. `{source}` is a
 * short hash of the Commons file name, so replacing a species' photo gives it a
 * new key: the next run mirrors the new photo instead of keeping the old one
 * under the new credits, and no cache keeps serving the old copy.
 *
 * With --write it records each `image.r2Key` on the species in the database
 * (WildlifeEditor::recordMirroredPhoto), in its published record and in a
 * draft that shows the same photo; the page and the card switch to the R2 copy
 * from then on. Author and license stay in the record and keep being shown
 * under the photo. `php artisan wildlife:export` then refreshes the seed file.
 */
class MirrorWildlifeImages extends Command
{
    protected $signature = 'wildlife:mirror-images
        {--write : Record the R2 key of each mirrored photo on its species}
        {--dry-run : Only list what would be uploaded}';

    protected $description = 'Mirror the wildlife guide photos from Wikimedia Commons to R2';

    /** Mirrors IMAGE_WIDTHS in `Domain/wildlife/wildlife.ts`; the last is the full-size copy. */
    private const WIDTHS = [500, 960, 1280];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $full = self::WIDTHS[count(self::WIDTHS) - 1];

        if (! $dryRun && empty(config('filesystems.disks.r2.bucket'))) {
            $this->error('R2 storage (R2_BUCKET and its credentials) is not configured in this environment.');

            return self::FAILURE;
        }

        $disk = $dryRun ? null : Storage::disk('r2');
        $mirroredNow = [];
        $failed = 0;

        foreach ($this->photos() as ['slug' => $slug, 'image' => $image]) {
            $file = (string) $image['commonsFile'];
            $base = 'wildlife/'.$slug.'-'.substr(sha1($file), 0, 8);
            $key = $base.'.jpg';
            $variants = [];
            foreach (self::WIDTHS as $width) {
                $variants[$width] = $width === $full ? $key : $base.'-'.$width.'.jpg';
            }

            $mirrored = ($image['r2Key'] ?? null) === $key
                && ($dryRun || collect($variants)->every(fn (string $k): bool => $disk->exists($k)));
            if ($mirrored) {
                $this->line(" Already mirrored: {$key}");

                continue;
            }

            if ($dryRun) {
                $this->line(" [DRY-RUN] {$file} -> R2: ".implode(', ', $variants));

                continue;
            }

            foreach ($variants as $width => $variantKey) {
                $source = 'https://commons.wikimedia.org/wiki/Special:FilePath/'.rawurlencode($file).'?width='.$width;
                $response = Http::withHeaders(['User-Agent' => 'syrianzone-wildlife-mirror/1.0 (+https://syrian.zone/wild)'])
                    ->timeout(60)
                    ->get($source);

                $type = (string) $response->header('Content-Type');
                if (! $response->successful() || ! str_starts_with($type, 'image/jpeg')) {
                    $this->warn(" Could not fetch {$file} at {$width}px ({$response->status()} {$type}); skipped.");
                    $failed++;

                    continue 2;
                }

                // The r2 disk does not throw, so a rejected write only shows as `false`.
                // The key is recorded only once every width is stored.
                if (! $disk->put($variantKey, $response->body(), ['visibility' => 'public', 'ContentType' => 'image/jpeg'])) {
                    $this->warn(" Could not upload {$file} at {$width}px to R2: {$variantKey}; skipped.");
                    $failed++;

                    continue 2;
                }
                $this->line(" Uploaded: {$file} ({$width}px) -> R2: {$variantKey}");
            }

            $mirroredNow[] = [$slug, $file, $key];
        }

        if ($mirroredNow !== [] && $this->option('write')) {
            foreach ($mirroredNow as [$slug, $file, $key]) {
                app(WildlifeEditor::class)->recordMirroredPhoto($slug, $file, $key);
            }
            $this->info('Recorded the R2 keys on the species. Run wildlife:export to refresh the seed file.');
        } elseif ($mirroredNow !== []) {
            $this->info('Photos uploaded. Run again with --write to record their R2 keys on the species.');
        }

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * Each distinct photo of each species: the published record's, and a
     * draft's when it shows a different file.
     *
     * @return list<array{slug: string, image: array<string, mixed>}>
     */
    private function photos(): array
    {
        $photos = [];
        foreach (WildlifeSpecies::query()->orderBy('position')->get() as $species) {
            $seen = [];
            foreach ([$species->record, $species->draft] as $record) {
                $file = $record['image']['commonsFile'] ?? null;
                if (! is_string($file) || isset($seen[$file])) {
                    continue;
                }
                $seen[$file] = true;
                $photos[] = ['slug' => $species->slug, 'image' => $record['image']];
            }
        }

        return $photos;
    }
}
