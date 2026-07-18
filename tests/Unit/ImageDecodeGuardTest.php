<?php

use App\Services\AvatarService;
use App\Services\ImageDecodeGuard;
use App\Services\PlaceImageService;
use Illuminate\Http\UploadedFile;

function declaredPngDimensions(int $width, int $height): UploadedFile
{
    $header = pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0);
    $chunk = 'IHDR'.$header;
    $bytes = "\x89PNG\r\n\x1a\n".pack('N', strlen($header)).$chunk.pack('N', crc32($chunk));
    $path = tempnam(sys_get_temp_dir(), 'declared-pixels').'.png';
    file_put_contents($path, $bytes);

    return new UploadedFile($path, 'declared-pixels.png', 'image/png', null, true);
}

test('shared GD budget accepts eight million declared pixels', function () {
    $image = declaredPngDimensions(4000, 2000);

    expect(ImageDecodeGuard::MAX_PIXELS)->toBe(8_000_000)
        ->and(app(AvatarService::class)->dimensionsAreSafe($image))->toBeTrue()
        ->and(app(PlaceImageService::class)->dimensionsAreSafe($image))->toBeTrue();
});

test('shared GD budget rejects the first pixel above eight million', function () {
    $image = declaredPngDimensions(4001, 2000);

    expect(app(AvatarService::class)->dimensionsAreSafe($image))->toBeFalse()
        ->and(app(PlaceImageService::class)->dimensionsAreSafe($image))->toBeFalse();
});

test('shared GD budget also checks stored image bytes', function () {
    $safe = file_get_contents(declaredPngDimensions(4000, 2000)->getRealPath());
    $unsafe = file_get_contents(declaredPngDimensions(4001, 2000)->getRealPath());
    $guard = app(ImageDecodeGuard::class);

    expect($guard->binaryDimensionsAreSafe($safe, 200))->toBeTrue()
        ->and($guard->binaryDimensionsAreSafe($unsafe, 200))->toBeFalse();
});
