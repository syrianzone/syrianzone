<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use RuntimeException;
use Throwable;

class AvatarService
{
    public function __construct(
        private readonly ImageDecodeGuard $decodeGuard,
        private readonly MediaCleanupService $cleanup,
    ) {}

    public function dimensionsAreSafe(UploadedFile $file): bool
    {
        return $this->decodeGuard->dimensionsAreSafe($file, 64);
    }

    public function update(User $user, UploadedFile $file): string
    {
        if (! $this->dimensionsAreSafe($file)) {
            throw new RuntimeException('Unsafe avatar image');
        }

        $binary = file_get_contents($file->getRealPath());
        if (! is_string($binary)) {
            throw new RuntimeException('Could not read avatar image');
        }

        $manager = ImageManager::withDriver(Driver::class);
        $webp = (string) $manager->read($binary)
            ->cover(256, 256)
            ->toWebp(quality: 80);

        $diskName = (string) config('filesystems.media_disk');
        $disk = Storage::disk($diskName);
        $path = "avatars/{$user->id}/".Str::uuid().'.webp';
        if ($disk->put($path, $webp) !== true) {
            throw new RuntimeException("Failed writing {$path}");
        }

        $newUrl = $disk->url($path);
        try {
            DB::transaction(function () use ($diskName, $newUrl, $path, $user): void {
                $account = User::withTrashed()->whereKey($user->id)->lockForUpdate()->firstOrFail();
                if ($account->trashed() || $account->is_banned) {
                    throw new RuntimeException('Account is inactive');
                }

                $oldDisk = $account->avatar_disk;
                $oldPath = $account->avatar_path;
                $account->forceFill([
                    'avatar_disk' => $diskName,
                    'avatar_path' => $path,
                    'avatar_url' => $newUrl,
                ])->save();
                if (is_string($oldDisk) && $oldDisk !== '' && is_string($oldPath) && $oldPath !== '') {
                    $this->cleanup->queueFiles([$oldPath], $oldDisk);
                }
            });
        } catch (Throwable $error) {
            try {
                $this->cleanup->queueFiles([$path], $diskName);
            } catch (Throwable) {
                try {
                    $disk->delete($path);
                } catch (Throwable) {
                    // Preserve the original publication error.
                }
            }

            throw $error;
        }

        $user->refresh();

        return $newUrl;
    }

    public function deleteAllFor(int $userId, ?string $disk = null): void
    {
        if ($userId < 1) {
            throw new RuntimeException('Invalid user identifier');
        }

        $this->cleanup->queueDirectory("avatars/{$userId}", $disk);
    }
}
