<?php

use App\Models\PlacePhoto;
use App\Services\PlaceImageService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

// Data migration: photos uploaded while production lacked ext-exif were encoded
// with their portrait orientation ignored. Regenerate display/thumb from the
// stored originals once, on the first boot of the image that carries ext-exif.
return new class extends Migration
{
  public function up(): void
  {
    if (!extension_loaded('exif')) {
      // reprocessing without exif would rewrite the same wrong pixels; skip
      Log::warning('reprocess_place_photos: ext-exif missing, skipping reprocess');
      return;
    }

    $images = app(PlaceImageService::class);
    foreach (PlacePhoto::query()->cursor() as $photo) {
      try {
        $images->reprocess($photo);
      } catch (\Throwable $e) {
        // a broken photo must not break the deploy; places:reprocess-photos can retry it
        Log::warning("reprocess_place_photos: photo {$photo->id} failed: {$e->getMessage()}");
      }
    }
  }

  public function down(): void
  {
    // nothing to restore: the regenerated variants replace broken ones in place
  }
};
