<?php

namespace App\Console\Commands;

use App\Models\PlacePhoto;
use App\Services\PlaceImageService;
use Illuminate\Console\Command;

class ReprocessPlacePhotos extends Command
{
  protected $signature = 'places:reprocess-photos {--place= : only photos of this place id}';
  protected $description = 'Regenerate display and thumb images from the stored originals (run after an image pipeline fix)';

  public function handle(PlaceImageService $images): int
  {
    $query = PlacePhoto::query();
    if ($this->option('place')) {
      $query->where('place_id', $this->option('place'));
    }

    $ok = 0;
    $failed = 0;
    foreach ($query->cursor() as $photo) {
      try {
        $images->reprocess($photo);
        $ok++;
      } catch (\Throwable $e) {
        $failed++;
        $this->warn("photo {$photo->id} ({$photo->original_path}): {$e->getMessage()}");
      }
    }

    $this->info("reprocessed {$ok}, failed {$failed}");
    return $failed === 0 ? self::SUCCESS : self::FAILURE;
  }
}
