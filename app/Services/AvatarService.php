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
  // Processes, stores, updates the user row, deletes the old file; returns the new absolute url.
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
    $newUrl = $disk->url($path);
    $user->update(['avatar_url' => $newUrl]);

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
}
