<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

class AvatarService
{
  // Processes, stores, updates the user row, deletes the old file; returns the new public url.
  public function update(User $user, UploadedFile $file): string
  {
    $disk = Storage::disk(config('filesystems.media_disk'));

    $manager = ImageManager::usingDriver(\Intervention\Image\Drivers\Gd\Driver::class);
    $webp = (string) $manager->decodeBinary(file_get_contents($file->getRealPath()))
      ->cover(256, 256)
      ->encode(new WebpEncoder(quality: 80));

    // Fresh uuid every upload: the CDN caches paths immutably and ignores query
    // strings, so only a never-seen path reliably busts.
    $path = "avatars/{$user->id}/" . Str::uuid() . '.webp';
    // the disk is configured with throw=false, so writes fail by returning false
    if ($disk->put($path, $webp) !== true) {
      throw new \RuntimeException("failed writing {$path}");
    }

    $old = $user->avatar_url;
    $newUrl = $this->publicUrl($disk, $path);
    try {
      $user->update(['avatar_url' => $newUrl]);
    } catch (\Throwable $e) {
      // The file is already on disk but the row did not update: remove the
      // orphan so a failed upload does not leak R2 objects.
      $disk->delete($path);
      throw $e;
    }

    // Only delete files we host; anything else (Google lh3 urls, null) is left
    // alone. Ownership is structural (/avatars/{id}/ in the url path) rather
    // than a prefix check against the current disk's base url, so avatars
    // uploaded before a MEDIA_DISK switch are still recognized and attempted.
    // throw=false on the disk means a failed or missing delete cannot bubble.
    $oldPath = $old !== null ? parse_url($old, PHP_URL_PATH) : null;
    $marker = "/avatars/{$user->id}/";
    $pos = is_string($oldPath) ? strpos($oldPath, $marker) : false;
    if ($pos !== false) {
      $disk->delete(ltrim(substr($oldPath, $pos), '/'));
    }

    return $newUrl;
  }

  /**
   * Delete all hosted avatar files for a user. Called on account deletion so
   * avatars/{id}/* does not orphan on R2 (the privacy policy promises full
   * profile erasure; Google lh3 URLs are remote and need no cleanup).
   */
  public function deleteForUser(User $user): void
  {
    $disk = Storage::disk(config('filesystems.media_disk'));
    $prefix = "avatars/{$user->id}/";
    try {
      $files = $disk->files($prefix);
      if (!empty($files)) {
        $disk->delete($files);
      }
    } catch (\Throwable $e) {
      report($e);
    }
  }

  /**
   * Public URL for a stored avatar. Local disks resolve to a root-relative
   * /storage/... path instead of Storage::url(), which prefixes APP_URL —
   * a misconfigured APP_URL (path suffix, trailing slash) would otherwise
   * produce broken absolute URLs like /api//storage/.... CDN (s3/r2)
   * disks still need their absolute URL.
   */
  private function publicUrl($disk, string $path): string
  {
    $diskName = config('filesystems.media_disk');
    if (config("filesystems.disks.{$diskName}.driver") === 'local') {
      return '/storage/' . ltrim($path, '/');
    }

    return $disk->url($path);
  }
}
