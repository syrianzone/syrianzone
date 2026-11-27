<?php

use App\Support\Facts;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * `wildlife:mirror-images` copies the Commons photos to R2. These runs never
 * pass --write, so resources/data/wildlife.json is left alone; whether the
 * command would record the keys shows in its closing line.
 */
beforeEach(function () {
    config(['filesystems.disks.r2.bucket' => 'test-bucket']);
    Http::fake(['commons.wikimedia.org/*' => Http::response('jpeg-bytes', 200, ['Content-Type' => 'image/jpeg'])]);
});

test('each photo is stored under a key naming its Commons file', function () {
    Storage::fake('r2');
    $species = Facts::json('wildlife')['species'][0];
    $base = 'wildlife/'.$species['slug'].'-'.substr(sha1($species['image']['commonsFile']), 0, 8);

    $this->artisan('wildlife:mirror-images')
        ->expectsOutputToContain('Run again with --write')
        ->assertSuccessful();

    foreach ([$base.'-500.jpg', $base.'-960.jpg', $base.'.jpg'] as $key) {
        Storage::disk('r2')->assertExists($key);
    }
});

test('a rejected upload fails the run and records no key', function () {
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('exists')->andReturn(false);
    $disk->shouldReceive('put')->andReturn(false);
    Storage::set('r2', $disk);

    $this->artisan('wildlife:mirror-images')
        ->expectsOutputToContain('Could not upload')
        ->doesntExpectOutputToContain('Run again with --write')
        ->assertFailed();
});
