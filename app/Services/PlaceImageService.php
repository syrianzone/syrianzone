<?php

namespace App\Services;

use App\Models\PlacePhoto;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use RuntimeException;
use Throwable;

class PlaceImageService
{
    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public function dimensionsAreSafe(UploadedFile $file): bool
    {
        $dimensions = @getimagesize($file->getRealPath());

        if (! is_array($dimensions)) {
            return false;
        }

        [$width, $height] = $dimensions;

        return $width >= 200
          && $height >= 200
          && $width <= 6000
          && $height <= 6000
          && ($width * $height) <= 20_000_000;
    }

    public function store(UploadedFile $file, int $placeId, int $sort): PlacePhoto
    {
        $mime = $file->getMimeType();
        $extension = self::MIME_EXTENSIONS[$mime] ?? null;

        if (! $extension || ! $this->dimensionsAreSafe($file)) {
            throw new RuntimeException('Unsafe place image');
        }

        $id = (string) Str::uuid();
        $directory = $this->directory($placeId);
        $originalPath = "{$directory}/{$id}.{$extension}";
        $displayPath = "{$directory}/{$id}_display.webp";
        $thumbPath = "{$directory}/{$id}_thumb.webp";
        $disk = Storage::disk('public');
        $written = [];

        try {
            if (! $disk->putFileAs($directory, $file, "{$id}.{$extension}")) {
                throw new RuntimeException('Could not store place image');
            }
            $written[] = $originalPath;

            $manager = new ImageManager(new Driver);
            $display = $manager->read($file->getRealPath())->orient()->scaleDown(width: 1600, height: 1600);
            if (! $disk->put($displayPath, (string) $display->toWebp(quality: 80))) {
                throw new RuntimeException('Could not store place display image');
            }
            $written[] = $displayPath;

            $thumb = $manager->read($file->getRealPath())->orient()->cover(400, 400);
            if (! $disk->put($thumbPath, (string) $thumb->toWebp(quality: 75))) {
                throw new RuntimeException('Could not store place thumbnail');
            }
            $written[] = $thumbPath;

            return PlacePhoto::create([
                'place_id' => $placeId,
                'original_path' => $originalPath,
                'display_path' => $displayPath,
                'thumb_path' => $thumbPath,
                'sort' => $sort,
            ]);
        } catch (Throwable $error) {
            $disk->delete($written);

            throw $error;
        }
    }

    public function deletePlaceFiles(int $placeId): void
    {
        $disk = Storage::disk('public');
        $directory = $this->directory($placeId);

        if ($disk->directoryExists($directory) && ! $disk->deleteDirectory($directory)) {
            throw new RuntimeException('Could not delete place images');
        }
    }

    private function directory(int $placeId): string
    {
        if ($placeId < 1) {
            throw new RuntimeException('Invalid place identifier');
        }

        return "places/{$placeId}";
    }
}
