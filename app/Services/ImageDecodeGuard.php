<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;

final class ImageDecodeGuard
{
    public const MAX_PIXELS = 8_000_000;

    private const MAX_DIMENSION = 6000;

    public function dimensionsAreSafe(UploadedFile $file, int $minimumDimension): bool
    {
        return $this->dimensionsMeetBudget(@getimagesize($file->getRealPath()), $minimumDimension);
    }

    public function dimensionsExceedBudget(UploadedFile $file, int $minimumDimension): bool
    {
        $dimensions = @getimagesize($file->getRealPath());

        return is_array($dimensions)
            && ! $this->dimensionsMeetBudget($dimensions, $minimumDimension);
    }

    public function binaryDimensionsAreSafe(string $binary, int $minimumDimension): bool
    {
        return $this->dimensionsMeetBudget(@getimagesizefromstring($binary), $minimumDimension);
    }

    private function dimensionsMeetBudget(array|false $dimensions, int $minimumDimension): bool
    {
        if (! is_array($dimensions)) {
            return false;
        }

        [$width, $height] = $dimensions;

        // GD can use about 6.6 bytes per source pixel. This caps the source near
        // 53 MB and leaves room for transformed copies under a 128 MB limit.
        return $width >= $minimumDimension
            && $height >= $minimumDimension
            && $width <= self::MAX_DIMENSION
            && $height <= self::MAX_DIMENSION
            && ($width * $height) <= self::MAX_PIXELS;
    }
}
