<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class GuessWhoCharacter extends Model
{
    use HasFactory;

    protected $table = 'guess_who_characters';

    protected $fillable = [
        'category_id',
        'name_ar',
        'name_en',
        'image_path',
        'attributes',
        'is_active',
    ];

    protected $casts = [
        'attributes' => 'array',
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'image_url',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(GuessWhoCategory::class, 'category_id');
    }

    public function getImageUrlAttribute(): string
    {
        return self::resolveImageUrl($this->image_path);
    }

    /**
     * Resolve the configured media disk, falling back to `public` when `r2` is
     * selected without a bucket or when the configured disk does not exist.
     */
    public static function mediaDisk(): string
    {
        $disk = (string) config('filesystems.media_disk', 'public');

        if ($disk === 'r2' && empty(config('filesystems.disks.r2.bucket'))) {
            return 'public';
        }

        return config("filesystems.disks.{$disk}") ? $disk : 'public';
    }

    /**
     * Resolve a stored character image path to a browser-usable URL.
     * Preserves full URLs and leading-slash paths (`/storage/...`, `/images/...`),
     * and maps relative keys onto R2 or `/storage/...` based on `media_disk`.
     */
    public static function resolveImageUrl(?string $path): string
    {
        if (! $path) {
            return '';
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://') || str_starts_with($path, '/')) {
            return $path;
        }

        $relative = ltrim($path, '/');

        if (self::mediaDisk() === 'r2') {
            $r2Url = rtrim((string) config('filesystems.disks.r2.url', ''), '/');

            return $r2Url !== '' ? "{$r2Url}/{$relative}" : Storage::disk('r2')->url($relative);
        }

        return '/storage/'.$relative;
    }

    /**
     * Best-effort delete of a stored character image from its owning disk.
     * Supports relative keys, `/storage/...` paths, and R2 URLs under `guesswho/`.
     */
    public static function deleteStoredImage(?string $path): void
    {
        if (! $path) {
            return;
        }

        $diskName = self::mediaDisk();
        $key = $path;

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            $r2Url = rtrim((string) config('filesystems.disks.r2.url', ''), '/');
            if ($r2Url === '' || ! str_starts_with($path, $r2Url.'/')) {
                return;
            }
            $diskName = 'r2';
            $key = substr($path, strlen($r2Url) + 1);
        } elseif (str_starts_with($path, '/storage/')) {
            $diskName = 'public';
            $key = substr($path, strlen('/storage/'));
        } elseif (str_starts_with($path, '/')) {
            return;
        }

        if (! str_starts_with($key, 'guesswho/')) {
            return;
        }

        try {
            $disk = Storage::disk($diskName);
            if ($disk->exists($key)) {
                $disk->delete($key);
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
