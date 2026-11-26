<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Copies the wildlife guide's photos from Wikimedia Commons to the R2 media
 * store, so pages stop hotlinking Commons and share cards can draw them
 * (Commons is not an allowed card-image host). Each photo is stored at every
 * width the pages request (IMAGE_WIDTHS in `Domain/wildlife/wildlife.ts`): the
 * largest at `wildlife/{slug}.jpg`, the key the data records, and the others
 * beside it as `wildlife/{slug}-{width}.jpg`.
 *
 * With --write it records each `image.r2Key` in resources/data/wildlife.json;
 * the page and the card switch to the R2 copy from then on. Author and license
 * stay in the data file and keep being shown under the photo.
 */
class MirrorWildlifeImages extends Command
{
    protected $signature = 'wildlife:mirror-images
        {--write : Record the R2 key of each mirrored photo in resources/data/wildlife.json}
        {--dry-run : Only list what would be uploaded}';

    protected $description = 'Mirror the wildlife guide photos from Wikimedia Commons to R2';

    private const DATA = 'data/wildlife.json';

    /** Mirrors IMAGE_WIDTHS in `Domain/wildlife/wildlife.ts`; the last is the full-size copy. */
    private const WIDTHS = [500, 960, 1280];

    public function handle(): int
    {
        $path = resource_path(self::DATA);
        $data = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        $dryRun = (bool) $this->option('dry-run');
        $full = self::WIDTHS[count(self::WIDTHS) - 1];

        if (! $dryRun && empty(config('filesystems.disks.r2.bucket'))) {
            $this->error('R2 storage (R2_BUCKET and its credentials) is not configured in this environment.');

            return self::FAILURE;
        }

        $disk = $dryRun ? null : Storage::disk('r2');
        $changed = false;
        $failed = 0;

        foreach ($data['species'] as $i => $species) {
            $file = (string) $species['image']['commonsFile'];
            $key = 'wildlife/'.$species['slug'].'.jpg';
            $variants = [];
            foreach (self::WIDTHS as $width) {
                $variants[$width] = $width === $full ? $key : 'wildlife/'.$species['slug'].'-'.$width.'.jpg';
            }

            $mirrored = ($species['image']['r2Key'] ?? null) === $key
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

                $disk->put($variantKey, $response->body(), ['visibility' => 'public', 'ContentType' => 'image/jpeg']);
                $this->line(" Uploaded: {$file} ({$width}px) -> R2: {$variantKey}");
            }

            $data['species'][$i]['image']['r2Key'] = $key;
            $changed = true;
        }

        if ($changed && $this->option('write')) {
            file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n");
            $this->info('Recorded the R2 keys in resources/'.self::DATA.'.');
        } elseif ($changed) {
            $this->info('Photos uploaded. Run again with --write to record their R2 keys in the data file.');
        }

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
