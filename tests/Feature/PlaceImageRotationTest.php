<?php

use App\Models\Place;
use App\Services\PlaceImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function rotationPhoto(): array
{
    Storage::fake('public');
    $place = Place::factory()->approved()->create();
    $photo = app(PlaceImageService::class)->store(
        UploadedFile::fake()->image('landscape.jpg', 800, 600),
        $place->id,
        0,
    );

    return [$photo, Storage::disk('public')];
}

test('manual rotation survives later reprocessing from the original', function () {
    [$photo, $disk] = rotationPhoto();
    $images = app(PlaceImageService::class);

    $images->rotateClockwise($photo);
    $rotated = $photo->fresh();
    $disk->assertExists($rotated->original_path);
    [$rotatedWidth, $rotatedHeight] = getimagesizefromstring($disk->get($rotated->display_path));

    $images->reprocess($rotated);
    $reprocessed = $rotated->fresh();
    [$reprocessedWidth, $reprocessedHeight] = getimagesizefromstring($disk->get($reprocessed->display_path));

    expect($rotated->rotation_degrees)->toBe(90)
        ->and($rotatedHeight)->toBeGreaterThan($rotatedWidth)
        ->and($reprocessed->rotation_degrees)->toBe(90)
        ->and($reprocessedHeight)->toBeGreaterThan($reprocessedWidth);
});

test('a failed thumb write keeps both published variants and retry rotates only once', function () {
    [$photo, $disk] = rotationPhoto();
    $oldDisplayPath = $photo->display_path;
    $oldThumbPath = $photo->thumb_path;
    $oldDisplay = $disk->get($oldDisplayPath);
    $oldThumb = $disk->get($oldThumbPath);
    $puts = 0;
    $failingDisk = Mockery::mock($disk)->makePartial();
    $failingDisk->shouldReceive('put')->andReturnUsing(function (string $path, mixed $contents, mixed $options = []) use ($disk, &$puts): bool {
        $puts++;

        return $puts === 2 ? false : $disk->put($path, $contents, $options);
    });
    Storage::set('public', $failingDisk);

    expect(fn () => app(PlaceImageService::class)->rotateClockwise($photo))
        ->toThrow(RuntimeException::class, 'Failed writing');

    Storage::set('public', $disk);
    $failed = $photo->fresh();
    expect($failed->display_path)->toBe($oldDisplayPath)
        ->and($failed->thumb_path)->toBe($oldThumbPath)
        ->and($failed->rotation_degrees)->toBe(0)
        ->and($disk->get($oldDisplayPath))->toBe($oldDisplay)
        ->and($disk->get($oldThumbPath))->toBe($oldThumb)
        ->and($disk->allFiles("places/{$photo->place_id}"))->toHaveCount(3);

    app(PlaceImageService::class)->rotateClockwise($failed);
    $retried = $failed->fresh();
    [$width, $height] = getimagesizefromstring($disk->get($retried->display_path));

    expect($retried->rotation_degrees)->toBe(90)
        ->and($height)->toBeGreaterThan($width);
});

test('reprocessing rejects an oversized stored original before GD decodes it', function () {
    [$photo, $disk] = rotationPhoto();
    $header = pack('NNCCCCC', 4001, 2000, 8, 2, 0, 0, 0);
    $chunk = 'IHDR'.$header;
    $unsafe = "\x89PNG\r\n\x1a\n".pack('N', strlen($header)).$chunk.pack('N', crc32($chunk));
    $disk->put($photo->original_path, $unsafe);
    $before = $photo->fresh()->only(['display_path', 'thumb_path', 'rotation_degrees']);

    expect(fn () => app(PlaceImageService::class)->reprocess($photo))
        ->toThrow(RuntimeException::class, 'Unsafe stored place image');

    expect($photo->fresh()->only(array_keys($before)))->toBe($before)
        ->and($disk->allFiles("places/{$photo->place_id}"))->toHaveCount(3);
});
