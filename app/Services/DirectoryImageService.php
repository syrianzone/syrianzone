<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

final class DirectoryImageService
{
    public const MAX_KILOBYTES = 5_120;

    public function __construct(
        private readonly ImageDecodeGuard $decodeGuard,
        private readonly MediaCleanupService $cleanup,
    ) {}

    public function rules(): array
    {
        return [
            'bail',
            'nullable',
            'max:'.self::MAX_KILOBYTES,
            function (string $attribute, mixed $value, callable $fail): void {
                if ($value instanceof UploadedFile && $this->dimensionsExceedBudget($value)) {
                    $fail('The image dimensions are not supported.');
                }
            },
            'image',
            'mimes:jpg,jpeg,png,webp',
            function (string $attribute, mixed $value, callable $fail): void {
                if (! $value instanceof UploadedFile || ! $this->dimensionsAreSafe($value)) {
                    $fail('The image dimensions are not supported.');
                }
            },
        ];
    }

    public function store(UploadedFile $file, string $directory): StoredDirectoryImage
    {
        if (! $this->dimensionsAreSafe($file)) {
            throw new RuntimeException('Unsafe directory image');
        }

        $directory = $this->normalizeDirectory($directory);
        $extension = match ($file->getMimeType()) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => throw new RuntimeException('Unsupported directory image type'),
        };
        $diskName = (string) config('filesystems.media_disk', 'public');
        $path = $file->storePubliclyAs(
            trim($directory, '/'),
            Str::uuid().".{$extension}",
            $diskName,
        );
        if (! is_string($path) || $path === '') {
            throw new RuntimeException('Could not store directory image');
        }

        return new StoredDirectoryImage(
            disk: $diskName,
            path: $path,
            url: Storage::disk($diskName)->url($path),
        );
    }

    public function discard(StoredDirectoryImage $image): void
    {
        try {
            $this->cleanup->queueFiles([$image->path], $image->disk);
        } catch (Throwable) {
            try {
                Storage::disk($image->disk)->delete($image->path);
            } catch (Throwable) {
                // Preserve the database publication failure.
            }
        }
    }

    public function queueManagedUrlDeletion(?string $url, string $directory): void
    {
        $path = $this->pathForManagedUrl($url, $directory);
        if ($path !== null) {
            $this->cleanup->queueFiles([$path], $this->diskName());
        }
    }

    public function queueLegacyWebUrlDeletion(
        ?string $url,
        string $directory,
        string $identifier,
    ): void {
        $path = $this->pathForLegacyWebUrl($url, $directory, $identifier);
        if ($path !== null) {
            $this->cleanup->queueFiles([$path], $this->diskName());
        }
    }

    public function pathForManagedUrl(?string $url, string $directory): ?string
    {
        if (! is_string($url) || trim($url) === '') {
            return null;
        }

        $directory = $this->normalizeDirectory($directory);
        $disk = Storage::disk($this->diskName());
        $prefix = rtrim($disk->url($directory), '/').'/';
        if (! str_starts_with($url, $prefix)) {
            return null;
        }

        $filename = substr($url, strlen($prefix));
        if (
            ! is_string($filename)
            || preg_match(
                '/\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)\z/i',
                $filename,
            ) !== 1
        ) {
            return null;
        }

        $path = "{$directory}/{$filename}";

        return hash_equals($disk->url($path), $url) ? $path : null;
    }

    private function pathForLegacyWebUrl(
        ?string $url,
        string $directory,
        string $identifier,
    ): ?string {
        if (
            ! is_string($url)
            || trim($url) === ''
            || preg_match('/\A[a-z0-9_-]+\z/i', $identifier) !== 1
        ) {
            return null;
        }

        $directory = $this->normalizeDirectory($directory);
        $disk = Storage::disk($this->diskName());
        $prefix = rtrim($disk->url($directory), '/').'/';
        if (! str_starts_with($url, $prefix)) {
            return null;
        }

        $filename = substr($url, strlen($prefix));
        if (
            ! is_string($filename)
            || preg_match(
                '/\A'.preg_quote($identifier, '/').'_[0-9]{1,20}\.(?:bmp|gif|jpe?g|png|webp)\z/i',
                $filename,
            ) !== 1
        ) {
            return null;
        }

        $path = "{$directory}/{$filename}";

        return hash_equals($disk->url($path), $url) ? $path : null;
    }

    private function dimensionsAreSafe(UploadedFile $file): bool
    {
        return $this->decodeGuard->dimensionsAreSafe($file, 32);
    }

    private function dimensionsExceedBudget(UploadedFile $file): bool
    {
        return $this->decodeGuard->dimensionsExceedBudget($file, 32);
    }

    private function diskName(): string
    {
        return (string) config('filesystems.media_disk', 'public');
    }

    private function normalizeDirectory(string $directory): string
    {
        $directory = trim($directory, '/');
        if (
            $directory === ''
            || str_contains($directory, '..')
            || preg_match('/\A[a-z0-9][a-z0-9_\/-]*\z/i', $directory) !== 1
        ) {
            throw new RuntimeException('Invalid directory image path');
        }

        return $directory;
    }
}
