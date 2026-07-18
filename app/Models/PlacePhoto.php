<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class PlacePhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'place_id',
        'original_path',
        'display_path',
        'thumb_path',
        'sort',
        'rotation_degrees',
        'reprocess_requested_at',
        'reprocess_available_at',
        'reprocess_attempts',
        'reprocess_last_error',
    ];

    protected $casts = [
        'sort' => 'integer',
        'rotation_degrees' => 'integer',
        'reprocess_requested_at' => 'datetime',
        'reprocess_available_at' => 'datetime',
        'reprocess_attempts' => 'integer',
    ];

    public function place()
    {
        return $this->belongsTo(Place::class);
    }

    public function getThumbUrlAttribute(): string
    {
        return $this->versionedUrl($this->thumb_path);
    }

    public function getDisplayUrlAttribute(): string
    {
        return $this->versionedUrl($this->display_path);
    }

    private function versionedUrl(string $path): string
    {
        $version = $this->updated_at?->getTimestamp() ?? 0;

        return Storage::disk(config('filesystems.media_disk'))->url($path)."?v={$version}";
    }
}
