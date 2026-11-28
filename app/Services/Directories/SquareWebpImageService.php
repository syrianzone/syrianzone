<?php

namespace App\Services\Directories;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Square WebP uploads for the directory modules.
 *
 * SyOfficialAdminController::uploadImage and GovAppsAdminController::uploadIcon
 * were near-identical ~50-line GD blocks differing only in their path prefix.
 * Both are now here, parameterised by directory, so the two admin surfaces and
 * the agent tools cannot drift on image handling.
 *
 * Falls back to storing the original upload when GD is unavailable or the bytes
 * are not decodable, rather than failing the admin's save. Callers get a usable
 * URL either way.
 */
class SquareWebpImageService
{
    public const SIZE = 200;

    public const QUALITY = 85;

    public const MAX_PIXELS = 24_000_000;

    /** @var list<int> */
    private const ALLOWED_TYPES = [
        IMAGETYPE_JPEG,
        IMAGETYPE_PNG,
        IMAGETYPE_WEBP,
        IMAGETYPE_GIF,
    ];

    /**
     * Store $file as a square WebP under "<directory>/<basename>_<ts>.webp".
     * Fails closed if the upload cannot be decoded or exceeds pixel bounds.
     *
     * @param  string  $directory  Path prefix, e.g. 'syofficial/entities'.
     * @return string Public URL, suitable for storing on a model column.
     */
    public function storeSquareWebp(UploadedFile $file, string $directory, string $basename): string
    {
        $contents = @file_get_contents($file->getRealPath());

        if ($contents === false || $contents === '') {
            throw new RuntimeException('Unable to read uploaded image.');
        }

        $stored = $this->storeSquareWebpFromBytes($contents, $directory, $basename);
        if ($stored === null) {
            throw new RuntimeException('The uploaded image could not be decoded or exceeds the maximum pixel dimensions.');
        }

        return $stored;
    }

    /**
     * Store raw image bytes as a square WebP under "<directory>/<basename>_<ts>.webp",
     * returning the public URL or null if the bytes cannot be decoded by GD.
     */
    public function storeSquareWebpFromBytes(string $contents, string $directory, string $basename): ?string
    {
        $webp = $this->encodeSquareWebpBytes($contents);

        if ($webp === null) {
            return null;
        }

        $disk = $this->resolveDisk();
        $fileName = trim($directory, '/')."/{$basename}_".time().'.webp';

        Storage::disk($disk)->put($fileName, $webp, 'public');

        return Storage::disk($disk)->url($fileName);
    }

    /**
     * Centre-crop to a square and encode as WebP, or null when not possible.
     */
    protected function encodeSquareWebp(UploadedFile $file): ?string
    {
        $contents = @file_get_contents($file->getRealPath());

        return $contents === false ? null : $this->encodeSquareWebpBytes($contents);
    }

    protected function encodeSquareWebpBytes(string $contents): ?string
    {
        if (! function_exists('imagecreatefromstring') || ! function_exists('imagewebp')) {
            return null;
        }

        $info = @getimagesizefromstring($contents);
        if (
            $info === false
            || ! isset($info[0], $info[1], $info[2])
            || ! in_array($info[2], self::ALLOWED_TYPES, true)
            || $info[0] <= 0
            || $info[1] <= 0
            || ($info[0] * $info[1]) > self::MAX_PIXELS
        ) {
            return null;
        }

        $source = @imagecreatefromstring($contents);

        if ($source === false) {
            return null;
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $side = min($width, $height);
        $startX = (int) max(0, ($width - $side) / 2);
        $startY = (int) max(0, ($height - $side) / 2);

        $canvas = imagecreatetruecolor(self::SIZE, self::SIZE);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);

        // Fill with fully-transparent white before resampling. Without this the
        // corners keep whatever was in the freshly allocated bitmap, which shows
        // up as a dark fringe on logos with alpha. Matches the behaviour the two
        // controllers had before this was extracted.
        $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
        imagefilledrectangle($canvas, 0, 0, self::SIZE, self::SIZE, $transparent);

        imagecopyresampled(
            $canvas, $source,
            0, 0, (int) $startX, (int) $startY,
            self::SIZE, self::SIZE, (int) $side, (int) $side
        );

        ob_start();
        $ok = imagewebp($canvas, null, self::QUALITY);
        $webp = ob_get_clean();

        imagedestroy($source);
        imagedestroy($canvas);

        if (! $ok || $webp === false || $webp === '') {
            throw new RuntimeException('Failed to encode image as WebP.');
        }

        return $webp;
    }

    /**
     * Prefer the configured media disk, falling back to public when unset so a
     * misconfigured MEDIA_DISK cannot break admin uploads.
     */
    protected function resolveDisk(): string
    {
        $disk = config('filesystems.media_disk', 'r2');

        return config("filesystems.disks.{$disk}") ? $disk : 'public';
    }
}
