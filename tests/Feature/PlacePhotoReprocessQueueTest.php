<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\PlaceImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Storage;

function queuedReprocessPhoto(): PlacePhoto
{
    Storage::fake('public');
    $place = Place::factory()->approved()->create();

    return app(PlaceImageService::class)->store(
        UploadedFile::fake()->image('queued.jpg', 800, 600),
        $place->id,
        0,
    );
}

test('the queue migration marks photos on databases that recorded the old migration', function () {
    $photo = queuedReprocessPhoto();
    $migration = require database_path('migrations/2026_07_18_000002_queue_place_photo_reprocessing.php');
    $migration->down();

    $migration->up();

    expect(DB::table('place_photos')->where('id', $photo->id)->value('reprocess_requested_at'))
        ->not->toBeNull();
});

test('the scheduled command clears a pending marker only after reprocessing succeeds', function () {
    $photo = queuedReprocessPhoto();
    $oldDisplay = $photo->display_path;
    $photo->forceFill([
        'reprocess_available_at' => now(),
        'reprocess_requested_at' => now(),
    ])->save();

    $this->artisan('places:reprocess-photos --pending')->assertSuccessful();

    $reprocessed = $photo->fresh();
    expect($reprocessed->display_path)->not->toBe($oldDisplay)
        ->and($reprocessed->reprocess_requested_at)->toBeNull();
});

test('a failed pending photo backs off without starving later photos', function () {
    $broken = queuedReprocessPhoto();
    $healthy = queuedReprocessPhoto();
    Storage::disk('public')->delete($broken->original_path);

    foreach ([$broken, $healthy] as $photo) {
        $photo->forceFill([
            'reprocess_available_at' => now(),
            'reprocess_requested_at' => now(),
        ])->save();
    }

    $this->artisan('places:reprocess-photos --pending --limit=2')->assertFailed();

    $broken->refresh();
    $healthy->refresh();
    expect($broken->reprocess_requested_at)->not->toBeNull()
        ->and($broken->reprocess_attempts)->toBe(1)
        ->and($broken->reprocess_available_at->isAfter(now()))->toBeTrue()
        ->and($broken->reprocess_last_error)->toContain('Original image is missing')
        ->and($healthy->reprocess_last_error)->toBeNull()
        ->and($healthy->reprocess_requested_at)->toBeNull()
        ->and($healthy->reprocess_attempts)->toBe(0);
});

test('the scheduler drains pending photo reprocessing', function () {
    $event = collect(Schedule::events())
        ->first(fn ($event): bool => str_contains($event->command, 'places:reprocess-photos --pending'));

    expect($event)->not->toBeNull();
});
