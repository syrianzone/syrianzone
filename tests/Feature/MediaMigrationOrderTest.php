<?php

test('media schema migrations run before photo and identity data migrations', function () {
    $names = collect(glob(database_path('migrations/*.php')))
        ->mapWithKeys(fn (string $path): array => [basename($path) => $path]);
    $reprocess = $names->keys()->first(fn (string $name): bool => str_ends_with($name, '_reprocess_place_photos.php'));
    $cleanup = $names->keys()->first(fn (string $name): bool => str_ends_with($name, '_create_media_cleanup_jobs_table.php'));
    $rotation = $names->keys()->first(fn (string $name): bool => str_ends_with($name, '_add_rotation_degrees_to_place_photos.php'));
    $avatar = $names->keys()->first(fn (string $name): bool => str_ends_with($name, '_add_avatar_storage_to_users_table.php'));
    $legacy = $names->keys()->first(fn (string $name): bool => str_ends_with($name, '_anonymize_legacy_deleted_users.php'));
    $queue = $names->keys()->first(fn (string $name): bool => str_ends_with($name, '_queue_place_photo_reprocessing.php'));

    expect($cleanup)->not->toBeNull()
        ->and($rotation)->not->toBeNull()
        ->and($avatar)->not->toBeNull()
        ->and($queue)->not->toBeNull()
        ->and($cleanup)->toBeLessThan($reprocess)
        ->and($rotation)->toBeLessThan($reprocess)
        ->and($reprocess)->toBeLessThan($queue)
        ->and($avatar)->toBeLessThan($legacy);
});

test("the recorded photo migration doesn't perform external image work", function () {
    $source = file_get_contents(database_path('migrations/2026_07_17_000001_reprocess_place_photos.php'));

    expect($source)->not->toContain('PlaceImageService')
        ->and($source)->not->toContain('reprocess($photo)');
});

test('the cleanup schema migration tolerates the legacy table already existing', function () {
    $migration = require database_path('migrations/2026_07_16_210000_create_media_cleanup_jobs_table.php');

    $migration->up();

    expect(Schema::hasTable('media_cleanup_jobs'))->toBeTrue();
});
