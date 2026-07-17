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
      $binary = file_get_contents($file->getRealPath());

      // the disk is configured with throw=false, so writes fail by returning false;
      // a silently missing original is unrecoverable data loss, fail the upload instead
      if ($disk->put($originalPath, $binary) !== true) {
        throw new \RuntimeException("failed writing {$originalPath}");
      }
      $written[] = $originalPath;

      [$display, $thumb] = $this->variants($binary);
      if ($disk->put($displayPath, $display) !== true) {
        throw new \RuntimeException("failed writing {$displayPath}");
      }
      $written[] = $displayPath;
      if ($disk->put($thumbPath, $thumb) !== true) {
        throw new \RuntimeException("failed writing {$thumbPath}");
      }
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
    if (!$disk->exists($photo->original_path)) {
      throw new \RuntimeException("original missing: {$photo->original_path}");
    }
    [$display, $thumb] = $this->variants($disk->get($photo->original_path));
    $disk->put($photo->display_path, $display);
    $disk->put($photo->thumb_path, $thumb);
    // bump updated_at so the versioned urls bypass the immutable browser cache
    $photo->touch();
  }

  // Rotates 90 degrees clockwise using the display as source: the escape hatch for
  // photos whose original is gone (thumb is re-derived so its crop follows the rotation).
  public function rotateClockwise(PlacePhoto $photo): void
  {
    $disk = Storage::disk('public');
    $manager = ImageManager::withDriver(\Intervention\Image\Drivers\Gd\Driver::class);
    $rotated = (string) $manager->read($disk->get($photo->display_path))->rotate(-90)->toWebp(quality: 80);
    $disk->put($photo->display_path, $rotated);
    $disk->put($photo->thumb_path, (string) $manager->read($rotated)->cover(400, 400)->toWebp(quality: 75));
    $photo->touch();
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
