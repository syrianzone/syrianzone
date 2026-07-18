<?php

namespace App\Services;

use App\Models\MediaCleanupJob;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class MediaCleanupService
{
    private const CLAIM_TTL_MINUTES = 15;

    private const MAX_BACKOFF_SECONDS = 3600;

    private const MIN_BACKOFF_SECONDS = 60;

    /**
     * @param  array<int, string>  $paths
     */
    public function queueFiles(array $paths, ?string $disk = null): void
    {
        $this->queue($paths, false, $disk);
    }

    public function queueDirectory(string $path, ?string $disk = null): void
    {
        $this->queue([$path], true, $disk);
    }

    /**
     * @return array{processed: int, deleted: int, failed: int}
     */
    public function retryPending(int $limit = 100): array
    {
        $now = now();
        $ids = MediaCleanupJob::query()
            ->where('available_at', '<=', $now)
            ->where(function ($query) use ($now): void {
                $query->whereNull('claimed_at')
                    ->orWhere('claimed_at', '<=', $now->copy()->subMinutes(self::CLAIM_TTL_MINUTES));
            })
            ->orderBy('available_at')
            ->orderBy('id')
            ->limit(max(1, min(1000, $limit)))
            ->pluck('id');
        $processed = 0;
        $deleted = 0;

        foreach ($ids as $id) {
            $result = $this->attempt((int) $id);
            if ($result === null) {
                continue;
            }
            $processed++;
            if ($result) {
                $deleted++;
            }
        }

        return [
            'processed' => $processed,
            'deleted' => $deleted,
            'failed' => $processed - $deleted,
        ];
    }

    /**
     * @param  array<int, string>  $paths
     */
    private function queue(array $paths, bool $isDirectory, ?string $disk): void
    {
        $disk ??= (string) config('filesystems.media_disk');
        $ids = [];

        foreach (array_values(array_unique(array_filter($paths))) as $path) {
            $job = MediaCleanupJob::query()->firstOrCreate(
                ['disk' => $disk, 'path' => $path],
                [
                    'available_at' => now(),
                    'is_directory' => $isDirectory,
                ],
            );
            $ids[] = $job->id;
        }

        if ($ids !== []) {
            DB::afterCommit(function () use ($ids): void {
                foreach ($ids as $id) {
                    $this->attempt($id);
                }
            });
        }
    }

    private function attempt(int $id): ?bool
    {
        $now = now();
        $token = (string) Str::uuid();
        $claimed = MediaCleanupJob::query()
            ->whereKey($id)
            ->where('available_at', '<=', $now)
            ->where(function ($query) use ($now): void {
                $query->whereNull('claimed_at')
                    ->orWhere('claimed_at', '<=', $now->copy()->subMinutes(self::CLAIM_TTL_MINUTES));
            })
            ->update([
                'claim_token' => $token,
                'claimed_at' => $now,
                'updated_at' => $now,
            ]);
        if ($claimed !== 1) {
            return null;
        }

        $job = MediaCleanupJob::query()->whereKey($id)->where('claim_token', $token)->first();
        if (! $job) {
            return null;
        }

        try {
            $disk = Storage::disk($job->disk);
            if ($job->is_directory) {
                $deleted = ! $disk->directoryExists($job->path)
                    || $disk->deleteDirectory($job->path);
            } else {
                $deleted = ! $disk->exists($job->path)
                    || $disk->delete($job->path);
            }
            if ($deleted !== true) {
                throw new RuntimeException('Filesystem deletion returned false');
            }

            MediaCleanupJob::query()->whereKey($id)->where('claim_token', $token)->delete();

            return true;
        } catch (Throwable $error) {
            $attempts = $job->attempts + 1;
            MediaCleanupJob::query()->whereKey($id)->where('claim_token', $token)->update([
                'attempts' => $attempts,
                'available_at' => now()->addSeconds($this->backoffSeconds($attempts)),
                'claim_token' => null,
                'claimed_at' => null,
                'last_error' => Str::limit($error->getMessage(), 2000),
                'updated_at' => now(),
            ]);

            return false;
        }
    }

    private function backoffSeconds(int $attempts): int
    {
        $exponent = min(6, max(0, $attempts - 1));

        return min(self::MAX_BACKOFF_SECONDS, self::MIN_BACKOFF_SECONDS * (2 ** $exponent));
    }
}
