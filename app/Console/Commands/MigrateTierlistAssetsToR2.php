<?php

namespace App\Console\Commands;

use App\Models\Candidate;
use App\Models\Question;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class MigrateTierlistAssetsToR2 extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tierlist:migrate-to-r2 {--dry-run : Only log actions without uploading or modifying DB}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Upload local TierList candidate images to R2 storage and update database URLs';

    /**
     * Directories containing local candidate images.
     */
    private const LOCAL_DIRECTORIES = [
        'public/tierlist-assets/images',
        'public/assets/tierlist',
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');

        if ($isDryRun) {
            $this->info('🔍 Running in DRY RUN mode. No files will be uploaded or DB updated.');
        }

        $r2Url = rtrim((string) config('filesystems.disks.r2.url', ''), '/');
        $r2Bucket = config('filesystems.disks.r2.bucket');

        if ((empty($r2Url) || empty($r2Bucket)) && ! $isDryRun) {
            $this->error('R2 storage (R2_URL / R2_BUCKET) is not configured in environment.');
            return Command::FAILURE;
        }

        $uploadedCount = 0;
        $skippedCount = 0;
        $urlMap = [];

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

        foreach (self::LOCAL_DIRECTORIES as $relDir) {
            $absDir = base_path($relDir);
            if (! File::exists($absDir)) {
                $this->warn("Directory {$relDir} does not exist. Skipping.");
                continue;
            }

            $files = File::allFiles($absDir);
            $this->info("Found " . count($files) . " files in {$relDir}.");

            foreach ($files as $file) {
                $relativePathname = str_replace('\\', '/', $file->getRelativePathname());
                $filename = $file->getFilename();

                // Store both with subfolder (tierlist/candidates/jolani/jolani75.png) and flat (tierlist/candidates/jolani75.png)
                $r2Path = 'tierlist/candidates/' . $filename;
                $cdnUrl = ($r2Url ? $r2Url : 'https://cdn.example.com') . '/' . $r2Path;

                // Map local path with relative subfolder (e.g. /tierlist-assets/images/jolani/jolani75.png)
                $relBaseDir = ltrim($relDir, 'public/');
                $urlMap['/' . $relBaseDir . '/' . $relativePathname] = $cdnUrl;
                $urlMap['/' . trim($relDir, '/') . '/' . $relativePathname] = $cdnUrl;
                $urlMap['/' . $relBaseDir . '/' . $filename] = $cdnUrl;
                $urlMap['/' . trim($relDir, '/') . '/' . $filename] = $cdnUrl;

                if ($isDryRun) {
                    $this->line(" [DRY-RUN] Would upload: {$relativePathname} -> R2: {$r2Path}");
                    $uploadedCount++;
                    continue;
                }

                if (! $disk || ! $disk->exists($r2Path)) {
                    $this->line(" Uploading: {$file->getFilename()} -> R2: {$r2Path}");
                    if ($disk) {
                        $stream = fopen($file->getRealPath(), 'r+');
                        $disk->put($r2Path, $stream, 'public');
                        if (is_resource($stream)) {
                            fclose($stream);
                        }
                    }
                    $uploadedCount++;
                } else {
                    $this->line(" Skipping existing: R2: {$r2Path}");
                    $skippedCount++;
                }
            }
        }

        $this->info("Upload step completed. Uploaded: {$uploadedCount}, Skipped: {$skippedCount}.");

        // Update database records in candidates table
        $updatedCandidates = 0;
        foreach (Candidate::whereNotNull('image_url')->cursor() as $candidate) {
            $currentUrl = $candidate->image_url;
            foreach ($urlMap as $localPath => $cdnUrl) {
                if ($currentUrl === $localPath || str_contains($currentUrl, $localPath)) {
                    if ($isDryRun) {
                        $this->line(" [DRY-RUN] Would update Candidate ID {$candidate->id} image_url: {$currentUrl} -> {$cdnUrl}");
                    } else {
                        $candidate->update(['image_url' => $cdnUrl]);
                    }
                    $updatedCandidates++;
                    break;
                }
            }
        }

        // Update database records in questions table if present and table exists
        $updatedQuestions = 0;
        if (class_exists(Question::class) && \Illuminate\Support\Facades\Schema::hasTable('questions')) {
            foreach (Question::whereNotNull('image_url')->cursor() as $question) {
                $currentUrl = $question->image_url;
                foreach ($urlMap as $localPath => $cdnUrl) {
                    if ($currentUrl === $localPath || str_contains($currentUrl, $localPath)) {
                        if ($isDryRun) {
                            $this->line(" [DRY-RUN] Would update Question ID {$question->id} image_url: {$currentUrl} -> {$cdnUrl}");
                        } else {
                            $question->update(['image_url' => $cdnUrl]);
                        }
                        $updatedQuestions++;
                        break;
                    }
                }
            }
        }

        $this->info("Database update completed. Candidates updated: {$updatedCandidates}, Questions updated: {$updatedQuestions}.");

        return Command::SUCCESS;
    }
}
