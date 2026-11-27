<?php

use App\Models\WildlifeSpecies;
use App\Services\Wildlife\WildlifeData;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * `wildlife:mirror-images` copies the Commons photos to R2, and with --write
 * records each key on its species in the database.
 */
beforeEach(function () {
    config(['filesystems.disks.r2.bucket' => 'test-bucket']);
    Http::fake(['commons.wikimedia.org/*' => Http::response('jpeg-bytes', 200, ['Content-Type' => 'image/jpeg'])]);
});

test('each photo is stored under a key naming its Commons file', function () {
    Storage::fake('r2');
    $species = app(WildlifeData::class)->all()[0];
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

test('with --write the key is recorded on the published record and on a draft showing the same photo', function () {
    Storage::fake('r2');
    $row = WildlifeSpecies::where('slug', 'golden-hamster')->first();
    $row->update(['draft' => $row->record]);
    $key = 'wildlife/golden-hamster-'.substr(sha1($row->record['image']['commonsFile']), 0, 8).'.jpg';

    $this->artisan('wildlife:mirror-images --write')->assertSuccessful();

    $row->refresh();
    expect($row->record['image']['r2Key'])->toBe($key)
        ->and($row->draft['image']['r2Key'])->toBe($key)
        ->and(collect(app(WildlifeData::class)->all())->firstWhere('slug', 'golden-hamster')['image']['r2Key'])->toBe($key);
});
