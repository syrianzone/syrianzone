<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

test('avatar storage backfill records only urls owned by the configured disk', function () {
    Storage::fake('public');
    config(['filesystems.media_disk' => 'public']);

    $owned = User::factory()->create();
    $ownedPath = "avatars/{$owned->id}/owned.webp";
    $owned->forceFill(['avatar_url' => Storage::disk('public')->url($ownedPath)])->save();

    $foreign = User::factory()->create();
    $foreignPath = "avatars/{$foreign->id}/foreign.webp";
    $foreign->forceFill(['avatar_url' => "https://foreign.example.test/{$foreignPath}"])->save();

    $migration = require database_path('migrations/2026_07_16_210002_add_avatar_storage_to_users_table.php');
    $migration->down();
    $migration->up();

    $ownedStorage = DB::table('users')->where('id', $owned->id)->first();
    $foreignStorage = DB::table('users')->where('id', $foreign->id)->first();
    expect($ownedStorage->avatar_disk)->toBe('public')
        ->and($ownedStorage->avatar_path)->toBe($ownedPath)
        ->and($foreignStorage->avatar_disk)->toBeNull()
        ->and($foreignStorage->avatar_path)->toBeNull();
});
