<?php

namespace App\Services;

use App\Models\PlacePhoto;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;

class PlaceImageService
{
  // Stores original + display webp + thumb webp on the public disk and creates the PlacePhoto row.
  public function store(UploadedFile $file, int $placeId, int $sort): PlacePhoto
  {
    $uuid = (string) Str::uuid();
    $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
    $dir = "places/{$placeId}";
    $originalPath = "{$dir}/{$uuid}.{$ext}";
    $displayPath = "{$dir}/{$uuid}_display.webp";
    $thumbPath = "{$dir}/{$uuid}_thumb.webp";
    $disk = Storage::disk('public');
    $written = [];

    try {
      $disk->putFileAs($dir, $file, "{$uuid}.{$ext}");
      $written[] = $originalPath;

      [$display, $thumb] = $this->variants(file_get_contents($file->getRealPath()));
      $disk->put($displayPath, $display);
      $written[] = $displayPath;
      $disk->put($thumbPath, $thumb);
      $written[] = $thumbPath;
    } catch (\Throwable $e) {
      // Clean up partial writes so the caller's transaction rollback leaves no orphan files.
      $disk->delete($written);
      throw $e;
    }

    return PlacePhoto::create([
      'place_id' => $placeId,
      'original_path' => $originalPath,
      'display_path' => $displayPath,
      'thumb_path' => $thumbPath,
      'sort' => $sort,
    ]);
  }

  // Regenerates display + thumb from the stored original (e.g. after a pipeline fix).
  public function reprocess(PlacePhoto $photo): void
  {
    $disk = Storage::disk('public');
    [$display, $thumb] = $this->variants($disk->get($photo->original_path));
    $disk->put($photo->display_path, $display);
    $disk->put($photo->thumb_path, $thumb);
  }

  // Deletes the three files for a photo from the public disk (row deletion is the caller's job).
  public function deleteFiles(PlacePhoto $photo): void
  {
    Storage::disk('public')->delete([$photo->original_path, $photo->display_path, $photo->thumb_path]);
  }

  /** @return array{string, string} display webp, thumb webp */
  private function variants(string $binary): array
  {
    $manager = ImageManager::withDriver(\Intervention\Image\Drivers\Gd\Driver::class);
    return [
      (string) $manager->read($binary)->scaleDown(width: 1600, height: 1600)->toWebp(quality: 80),
      (string) $manager->read($binary)->cover(400, 400)->toWebp(quality: 75),
    ];
  }
}
