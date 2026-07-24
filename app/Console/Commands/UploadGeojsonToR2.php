<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class UploadGeojsonToR2 extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'geojson:upload-to-r2 {--dry-run : Only log actions without uploading}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Upload original master GeoJSON files to R2 storage (/downloads/)';

    /**
     * Target GeoJSON files to upload.
     */
    private const GEOJSON_FILES = [
        'public/assets/population/syria_provinces.geojson' => 'downloads/syria_provinces.geojson',
        'public/assets/population/syr_admin1.geojson' => 'downloads/syr_admin1.geojson',
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');

        if ($isDryRun) {
            $this->info('🔍 Running in DRY RUN mode. No files will be uploaded.');
        }

        $r2Url = rtrim((string) config('filesystems.disks.r2.url', ''), '/');
        $r2Bucket = config('filesystems.disks.r2.bucket');

        if ((empty($r2Url) || empty($r2Bucket)) && ! $isDryRun) {
            $this->error('R2 storage (R2_URL / R2_BUCKET) is not configured in environment.');
            return Command::FAILURE;
        }

        $disk = null;
        if (! empty($r2Bucket)) {
            try {
                $disk = Storage::disk('r2');
            } catch (\Throwable $e) {
                if (! $isDryRun) {
                    $this->error('Failed to initialize R2 disk: ' . $e->getMessage());
                    return Command::FAILURE;
                }
            }
        }

        $uploadedCount = 0;
        $skippedCount = 0;

        foreach (self::GEOJSON_FILES as $relPath => $r2Path) {
            $absPath = base_path($relPath);

            if (! File::exists($absPath)) {
                $this->warn("Local file {$relPath} does not exist. Skipping.");
                continue;
            }

            $cdnUrl = ($r2Url ? $r2Url : 'https://pub-r2.syrianzone.com') . '/' . $r2Path;

            if ($isDryRun) {
                $this->line(" [DRY-RUN] Would upload: {$relPath} -> R2: {$r2Path} ({$cdnUrl})");
                $uploadedCount++;
                continue;
            }

            if (! $disk || ! $disk->exists($r2Path)) {
                $this->line(" Uploading: {$relPath} -> R2: {$r2Path}");
                if ($disk) {
                    $stream = fopen($absPath, 'r+');
                    $disk->put($r2Path, $stream, 'public');
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                }
                $uploadedCount++;
            } else {
                $this->line(" Skipping existing R2 file: {$r2Path}");
                $skippedCount++;
            }
        }

        $this->info("GeoJSON upload completed. Uploaded: {$uploadedCount}, Skipped: {$skippedCount}.");

        return Command::SUCCESS;
    }
}
