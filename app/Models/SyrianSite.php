<?php

namespace App\Models;

use App\Services\ExternalData\ExternalSheetCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SyrianSite extends Model
{
    public const CACHE_KEY = 'syrian_sites:public_v1';

    protected $table = 'syrian_sites';

    protected $fillable = [
        'slug',
        'name',
        'description',
        'url',
        'category',
        'tags',
        'icon_url',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'tags' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('id');
    }

    public static function forgetPublicCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(ExternalSheetCache::SITES);
    }

    /**
     * Shape expected by `resources/js/Pages/Sites/types.ts` (`Website`).
     *
     * @return array{id: string, name: string, url: string, type: string, description: string}
     */
    public function toFrontendRow(): array
    {
        return [
            'id' => $this->slug,
            'name' => $this->name,
            'url' => $this->url,
            'type' => (string) ($this->category ?? ''),
            'description' => (string) ($this->description ?? ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toPublicPayload(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'url' => $this->url,
            'category' => $this->category,
            'type' => $this->category,
            'tags' => is_array($this->tags) ? array_values($this->tags) : [],
            'icon_url' => $this->icon_url,
            'sort_order' => $this->sort_order,
        ];
    }
}
