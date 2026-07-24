<?php

namespace App\Services;

use App\Models\Candidate;
use Illuminate\Http\UploadedFile;
use RuntimeException;
use Throwable;

final class CandidateImageService
{
    private const DIRECTORY = 'candidates';

    private const ORPHAN_TTL_HOURS = 24;

    public function __construct(
        private readonly DirectoryImageService $images,
        private readonly MediaCleanupService $cleanup,
    ) {}

    public function rules(): array
    {
        return $this->images->rules();
    }

    public function store(UploadedFile $file): StoredDirectoryImage
    {
        try {
            $stored = $this->images->store($file, self::DIRECTORY);
        } catch (Throwable $error) {
            throw new RuntimeException('Could not store candidate image', 0, $error);
        }

        try {
            $this->cleanup->queueFilesAfter(
                [$stored->path],
                now()->addHours(self::ORPHAN_TTL_HOURS),
                $stored->disk,
            );
        } catch (Throwable $error) {
            $this->images->discard($stored);

            throw $error;
        }

        return $stored;
    }

    public function adopt(?string $url): void
    {
        $path = $this->managedPath($url);
        if ($path !== null) {
            $this->cleanup->cancelFiles([$path], $this->diskName());
        }
    }

    public function replace(?string $oldUrl, ?string $newUrl): void
    {
        $this->adopt($newUrl);
        if ($oldUrl !== $newUrl) {
            $this->release($oldUrl);
        }
    }

    public function release(?string $url): void
    {
        $path = $this->managedPath($url);
        if (
            $path !== null
            && ! Candidate::query()->where('image_url', $url)->exists()
        ) {
            $this->cleanup->queueFiles([$path], $this->diskName());
        }
    }

    private function managedPath(?string $url): ?string
    {
        return $this->images->pathForManagedUrl($url, self::DIRECTORY);
    }

    private function diskName(): string
    {
        return (string) config('filesystems.media_disk', 'public');
    }
}
