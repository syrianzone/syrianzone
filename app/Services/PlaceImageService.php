<?php

namespace App\Services;

use App\Models\PlacePhoto;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
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

    public function __construct(
        private readonly ImageDecodeGuard $decodeGuard,
        private readonly MediaCleanupService $cleanup,
    ) {}

    public function dimensionsAreSafe(UploadedFile $file): bool
    {
        return $this->decodeGuard->dimensionsAreSafe($file, 200);
    }

    public function store(UploadedFile $file, int $placeId, int $sort): PlacePhoto
    {
        $paths = $this->writeSet($file, $placeId);

        try {
            return PlacePhoto::create([
                'place_id' => $placeId,
                'sort' => $sort,
                ...$paths,
            ]);
        } catch (Throwable $error) {
            $this->disk()->delete(array_values($paths));

            throw $error;
        }
    }

    public function replace(PlacePhoto $photo, UploadedFile $file): void
    {
        $newPaths = $this->writeSet($file, $photo->place_id);

        try {
            DB::transaction(function () use ($photo, $newPaths): void {
                $locked = PlacePhoto::query()->lockForUpdate()->findOrFail($photo->id);
                $oldPaths = [$locked->original_path, $locked->display_path, $locked->thumb_path];
                $locked->forceFill([...$newPaths, 'rotation_degrees' => 0])->save();
                $this->cleanup->queueFiles($oldPaths);
                DB::afterRollBack(fn () => $this->disk()->delete(array_values($newPaths)));
            });
        } catch (Throwable $error) {
            $this->disk()->delete(array_values($newPaths));

            throw $error;
        }

        $photo->refresh();
    }

    public function reprocess(PlacePhoto $photo): void
    {
        $this->refreshVariants($photo, false);
    }

    public function rotateClockwise(PlacePhoto $photo): void
    {
        $this->refreshVariants($photo, true);
    }

    public function deleteFiles(PlacePhoto $photo): void
    {
        $this->cleanup->queueFiles([
            $photo->original_path,
            $photo->display_path,
            $photo->thumb_path,
        ]);
    }

    public function deletePlaceFiles(int $placeId): void
    {
        $this->cleanup->queueDirectory($this->directory($placeId));
    }

    /**
     * @return array{original_path: string, display_path: string, thumb_path: string}
     */
    private function writeSet(UploadedFile $file, int $placeId): array
    {
        $extension = self::MIME_EXTENSIONS[$file->getMimeType()] ?? null;
        if (! $extension || ! $this->dimensionsAreSafe($file)) {
            throw new RuntimeException('Unsafe place image');
        }

        $uuid = (string) Str::uuid();
        $directory = $this->directory($placeId);
        $originalPath = "{$directory}/{$uuid}.{$extension}";
        $displayPath = "{$directory}/{$uuid}_display.webp";
        $thumbPath = "{$directory}/{$uuid}_thumb.webp";
        $written = [];

        try {
            $binary = file_get_contents($file->getRealPath());
            if (! is_string($binary)) {
                throw new RuntimeException('Could not read place image');
            }

            $this->putOrFail($originalPath, $binary);
            $written[] = $originalPath;

            [$display, $thumb] = $this->variants($binary, 0);
            $this->putOrFail($displayPath, $display);
            $written[] = $displayPath;
            $this->putOrFail($thumbPath, $thumb);
            $written[] = $thumbPath;
        } catch (Throwable $error) {
            $this->disk()->delete($written);

            throw $error;
        }

        return [
            'original_path' => $originalPath,
            'display_path' => $displayPath,
            'thumb_path' => $thumbPath,
        ];
    }

    private function putOrFail(string $path, string $contents): void
    {
        if ($this->disk()->put($path, $contents) !== true) {
            throw new RuntimeException("Failed writing {$path}");
        }
    }

    private function disk(): Filesystem
    {
        return Storage::disk(config('filesystems.media_disk'));
    }

    /**
     * @return array{string, string}
     */
    private function variants(string $binary, int $rotationDegrees): array
    {
        $manager = ImageManager::withDriver(Driver::class);
        $image = $manager
            ->read($binary)
            ->scaleDown(width: 1600, height: 1600);
        if ($rotationDegrees !== 0) {
            $image = $image->rotate(-$rotationDegrees);
        }
        $display = (string) $image->toWebp(quality: 80);
        $thumb = (string) $manager
            ->read($display)
            ->cover(400, 400)
            ->toWebp(quality: 75);

        return [$display, $thumb];
    }

    private function refreshVariants(PlacePhoto $photo, bool $rotateClockwise): void
    {
        $newPaths = null;

        try {
            DB::transaction(function () use ($photo, $rotateClockwise, &$newPaths): void {
                $locked = PlacePhoto::query()->lockForUpdate()->findOrFail($photo->id);
                $disk = $this->disk();
                if ($rotateClockwise && ! $disk->exists($locked->display_path)) {
                    throw new RuntimeException("Display image is missing: {$locked->display_path}");
                }

                if (! $disk->exists($locked->original_path)) {
                    if (! $rotateClockwise) {
                        throw new RuntimeException("Original image is missing: {$locked->original_path}");
                    }

                    $binary = $disk->get($locked->display_path);
                    if (! $this->decodeGuard->binaryDimensionsAreSafe($binary, 200)) {
                        throw new RuntimeException('Unsafe stored place image');
                    }

                    $oldPaths = [$locked->display_path, $locked->thumb_path];
                    $newPaths = $this->writeVariants($binary, $locked->place_id, 90);
                    DB::afterRollBack(fn () => $disk->delete(array_values($newPaths)));
                    $locked->forceFill([
                        ...$newPaths,
                        'rotation_degrees' => ((int) $locked->rotation_degrees + 90) % 360,
                    ])->save();
                    $this->cleanup->queueFiles($oldPaths);

                    return;
                }

                $binary = $disk->get($locked->original_path);
                if (! $this->decodeGuard->binaryDimensionsAreSafe($binary, 200)) {
                    throw new RuntimeException('Unsafe stored place image');
                }

                $rotation = (int) $locked->rotation_degrees;
                if ($rotateClockwise) {
                    $rotation = ($rotation + 90) % 360;
                }

                $oldPaths = [$locked->display_path, $locked->thumb_path];
                $newPaths = $this->writeVariants(
                    $binary,
                    $locked->place_id,
                    $rotation,
                );
                DB::afterRollBack(fn () => $disk->delete(array_values($newPaths)));
                $locked->forceFill([
                    ...$newPaths,
                    'rotation_degrees' => $rotation,
                ])->save();
                $this->cleanup->queueFiles($oldPaths);
            });
        } catch (Throwable $error) {
            if (is_array($newPaths)) {
                $this->disk()->delete(array_values($newPaths));
            }

            throw $error;
        }

        $photo->refresh();
    }

    /**
     * @return array{display_path: string, thumb_path: string}
     */
    private function writeVariants(string $binary, int $placeId, int $rotationDegrees): array
    {
        $uuid = (string) Str::uuid();
        $directory = $this->directory($placeId);
        $paths = [
            'display_path' => "{$directory}/{$uuid}_display.webp",
            'thumb_path' => "{$directory}/{$uuid}_thumb.webp",
        ];
        $written = [];

        try {
            [$display, $thumb] = $this->variants($binary, $rotationDegrees);
            $this->putOrFail($paths['display_path'], $display);
            $written[] = $paths['display_path'];
            $this->putOrFail($paths['thumb_path'], $thumb);
            $written[] = $paths['thumb_path'];
        } catch (Throwable $error) {
            $this->disk()->delete($written);

            throw $error;
        }

        return $paths;
    }

    private function directory(int $placeId): string
    {
        if ($placeId < 1) {
            throw new RuntimeException('Invalid place identifier');
        }

        return "places/{$placeId}";
    }
}
