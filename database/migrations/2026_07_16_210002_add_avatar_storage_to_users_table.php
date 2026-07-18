<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('avatar_disk', 64)->nullable()->after('avatar_url');
            $table->string('avatar_path', 400)->nullable()->after('avatar_disk');
        });

        $disk = (string) config('filesystems.media_disk');
        DB::table('users')
            ->whereNotNull('avatar_url')
            ->orderBy('id')
            ->chunkById(100, function ($users) use ($disk): void {
                foreach ($users as $user) {
                    $urlPath = parse_url((string) $user->avatar_url, PHP_URL_PATH);
                    $marker = "/avatars/{$user->id}/";
                    $position = is_string($urlPath) ? strpos($urlPath, $marker) : false;
                    if ($position === false) {
                        continue;
                    }

                    $path = ltrim(substr($urlPath, $position), '/');
                    $ownedUrl = Storage::disk($disk)->url($path);
                    if (! hash_equals($ownedUrl, (string) $user->avatar_url)) {
                        continue;
                    }

                    DB::table('users')->where('id', $user->id)->update([
                        'avatar_disk' => $disk,
                        'avatar_path' => $path,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['avatar_disk', 'avatar_path']);
        });
    }
};
