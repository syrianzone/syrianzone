<?php

use App\Models\MediaCleanupJob;
use App\Models\Place;
use App\Services\MediaCleanupService;
use App\Services\PlaceImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

test('failed place media deletion leaves durable jobs that the command retries', function () {
    Storage::fake('public');
    $place = Place::factory()->approved()->create();
    $photo = app(PlaceImageService::class)->store(
        UploadedFile::fake()->image('cleanup.jpg', 800, 600),
        $place->id,
        0,
    );
    $paths = [$photo->original_path, $photo->display_path, $photo->thumb_path];
    $disk = Storage::disk('public');
    $failingDisk = Mockery::mock($disk)->makePartial();
    $failingDisk->shouldReceive('delete')->times(3)->andReturnFalse();
    Storage::set('public', $failingDisk);

    DB::transaction(function () use ($photo): void {
        app(PlaceImageService::class)->deleteFiles($photo);
        $photo->delete();
    });

    expect(MediaCleanupJob::query()->count())->toBe(3)
        ->and(MediaCleanupJob::query()->where('attempts', 1)->count())->toBe(3);
    $this->assertDatabaseMissing('place_photos', ['id' => $photo->id]);
    foreach ($paths as $path) {
        $disk->assertExists($path);
    }

    Storage::set('public', $disk);
    $this->travel(2)->minutes();
    $this->artisan('media:cleanup')->assertSuccessful();

    expect(MediaCleanupJob::query()->count())->toBe(0);
    foreach ($paths as $path) {
        $disk->assertMissing($path);
    }
});

test('rolled back media deletion neither deletes files nor leaves cleanup jobs', function () {
    Storage::fake('public');
    $place = Place::factory()->approved()->create();
    $photo = app(PlaceImageService::class)->store(
        UploadedFile::fake()->image('rollback.jpg', 800, 600),
        $place->id,
        0,
    );
    $paths = [$photo->original_path, $photo->display_path, $photo->thumb_path];

    expect(fn () => DB::transaction(function () use ($photo): void {
        app(PlaceImageService::class)->deleteFiles($photo);
        $photo->delete();

        throw new RuntimeException('force media rollback');
    }))->toThrow(RuntimeException::class, 'force media rollback');

    $this->assertDatabaseHas('place_photos', ['id' => $photo->id]);
    expect(MediaCleanupJob::query()->count())->toBe(0);
    foreach ($paths as $path) {
        Storage::disk('public')->assertExists($path);
    }
});

test('rotation publishes new variants while failed old-file cleanup stays retryable', function () {
    Storage::fake('public');
    $place = Place::factory()->approved()->create();
    $photo = app(PlaceImageService::class)->store(
        UploadedFile::fake()->image('rotate-cleanup.jpg', 800, 600),
        $place->id,
        0,
    );
    $oldPaths = [$photo->display_path, $photo->thumb_path];
    $disk = Storage::disk('public');
    $failingDisk = Mockery::mock($disk)->makePartial();
    $failingDisk->shouldReceive('exists')->with($oldPaths[0])->once()->andReturnTrue();
    $failingDisk->shouldReceive('exists')->with($oldPaths[1])->once()->andReturnTrue();
    $failingDisk->shouldReceive('delete')->twice()->andReturnFalse();
    Storage::set('public', $failingDisk);

    app(PlaceImageService::class)->rotateClockwise($photo);

    $rotated = $photo->fresh();
    expect($rotated->rotation_degrees)->toBe(90)
        ->and($rotated->display_path)->not->toBe($oldPaths[0])
        ->and($rotated->thumb_path)->not->toBe($oldPaths[1])
        ->and(MediaCleanupJob::query()->where('attempts', 1)->count())->toBe(2);

    Storage::set('public', $disk);
    $this->travel(2)->minutes();
    $this->artisan('media:cleanup')->assertSuccessful();

    expect(MediaCleanupJob::query()->count())->toBe(0);
    foreach ($oldPaths as $path) {
        $disk->assertMissing($path);
    }
});

test("failed jobs back off so later cleanup isn't starved", function () {
    Storage::fake('public');
    $disk = Storage::disk('public');
    foreach (['bad-a.webp', 'bad-b.webp', 'good.webp'] as $path) {
        $disk->put($path, $path);
        MediaCleanupJob::create(['available_at' => now(), 'disk' => 'public', 'path' => $path]);
    }
    $failingDisk = Mockery::mock($disk)->makePartial();
    $failingDisk->shouldReceive('delete')->twice()->andReturnFalse();
    Storage::set('public', $failingDisk);

    $first = app(MediaCleanupService::class)->retryPending(2);

    Storage::set('public', $disk);
    $second = app(MediaCleanupService::class)->retryPending(2);

    expect($first)->toMatchArray(['processed' => 2, 'deleted' => 0, 'failed' => 2])
        ->and($second)->toMatchArray(['processed' => 1, 'deleted' => 1, 'failed' => 0]);
    $disk->assertMissing('good.webp');
    $disk->assertExists('bad-a.webp');
    $disk->assertExists('bad-b.webp');
});

test('an active claim prevents a concurrent cleanup attempt', function () {
    Storage::fake('public');
    Storage::disk('public')->put('claimed.webp', 'claimed');
    MediaCleanupJob::create([
        'available_at' => now(),
        'claim_token' => (string) Str::uuid(),
        'claimed_at' => now(),
        'disk' => 'public',
        'path' => 'claimed.webp',
    ]);

    expect(app(MediaCleanupService::class)->retryPending())->toMatchArray([
        'processed' => 0,
        'deleted' => 0,
        'failed' => 0,
    ]);
    Storage::disk('public')->assertExists('claimed.webp');
});

test('already missing files and directories complete cleanup successfully', function () {
    Storage::fake('public');
    MediaCleanupJob::create([
        'available_at' => now(),
        'disk' => 'public',
        'path' => 'already-gone.webp',
    ]);
    MediaCleanupJob::create([
        'available_at' => now(),
        'disk' => 'public',
        'is_directory' => true,
        'path' => 'already-gone-directory',
    ]);

    expect(app(MediaCleanupService::class)->retryPending())->toMatchArray([
        'processed' => 2,
        'deleted' => 2,
        'failed' => 0,
    ])->and(MediaCleanupJob::query()->count())->toBe(0);
});

test('the scheduler retries durable media cleanup', function () {
    $event = collect(Schedule::events())
        ->first(fn ($event): bool => str_contains($event->command, 'media:cleanup'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('* * * * *');
});
