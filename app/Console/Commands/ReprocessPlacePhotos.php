<?php

namespace App\Console\Commands;

use App\Models\PlacePhoto;
use App\Services\PlaceImageService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Throwable;

class ReprocessPlacePhotos extends Command
{
    private const MAX_BACKOFF_SECONDS = 3600;

    private const MAX_PENDING_LIMIT = 1000;

    protected $signature = 'places:reprocess-photos
        {--place= : only photos of this place id}
        {--pending : only photos marked for reprocessing}
        {--limit=100 : maximum pending photos to process}';

    protected $description = 'Regenerate display and thumb images from the stored originals';

    public function handle(PlaceImageService $images): int
    {
        $pending = (bool) $this->option('pending');
        $query = PlacePhoto::query();
        if ($this->option('place')) {
            $query->where('place_id', $this->option('place'));
        }

        if ($pending) {
            $limit = max(1, min((int) $this->option('limit'), self::MAX_PENDING_LIMIT));
            $query
                ->whereNotNull('reprocess_requested_at')
                ->where(function ($due): void {
                    $due->whereNull('reprocess_available_at')
                        ->orWhere('reprocess_available_at', '<=', now());
                })
                ->orderBy('reprocess_available_at')
                ->orderBy('id')
                ->limit($limit);
        }

        $ok = 0;
        $failed = 0;
        $photos = $pending ? $query->get() : $query->lazyById();
        foreach ($photos as $photo) {
            try {
                $images->reprocess($photo);
                $photo->forceFill([
                    'reprocess_requested_at' => null,
                    'reprocess_available_at' => null,
                    'reprocess_attempts' => 0,
                    'reprocess_last_error' => null,
                ])->save();
                $ok++;
            } catch (Throwable $error) {
                $failed++;
                if ($pending) {
                    $attempts = min((int) $photo->reprocess_attempts + 1, 31);
                    $backoff = min(60 * (2 ** min($attempts - 1, 6)), self::MAX_BACKOFF_SECONDS);
                    $photo->forceFill([
                        'reprocess_attempts' => $attempts,
                        'reprocess_available_at' => now()->addSeconds($backoff),
                        'reprocess_last_error' => Str::limit($error->getMessage(), 4000, ''),
                    ])->save();
                }

                $this->warn("photo {$photo->id} ({$photo->original_path}): {$error->getMessage()}");
            }
        }

        $this->info("reprocessed {$ok}, failed {$failed}");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
