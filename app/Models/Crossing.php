<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class Crossing extends Model
{
    public const CACHE_KEY = 'crossings:public_v1';

    protected $fillable = [
        'slug',
        'name_ar',
        'name_en',
        'country',
        'governorate',
        'type',
        'status',
        'hours_ar',
        'notes_ar',
        'phone',
        'lat',
        'lng',
        'sort_order',
        'is_active',
        'meta',
    ];

    protected $casts = [
        'lat' => 'float',
        'lng' => 'float',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'meta' => 'array',
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
    }

    /**
     * Canonical DB-first reader shared by Web, JSON API, and MCP tools.
     * Uses active DB rows once the crossings table exists and has been seeded,
     * falling back to resources/data/crossings.json otherwise.
     *
     * @return array{meta: array<string, mixed>, crossings: list<array<string, mixed>>}
     */
    public static function publicDataset(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached) && isset($cached['crossings'])) {
            return $cached;
        }

        $fallback = self::fromJsonFallback();

        try {
            if (Schema::hasTable('crossings') && self::query()->exists()) {
                $rows = self::active()->ordered()->get();
                $dataset = [
                    'meta' => $fallback['meta'],
                    'crossings' => $rows->map(fn (self $c) => $c->toPublicPayload())->values()->all(),
                ];
                Cache::put(self::CACHE_KEY, $dataset, 300);

                return $dataset;
            }
        } catch (\Throwable $e) {
            Log::warning('crossings DB read failed, falling back to JSON', ['error' => $e->getMessage()]);
        }

        return $fallback;
    }

    /**
     * @return array<string, mixed>
     */
    public function toPublicPayload(): array
    {
        $meta = is_array($this->meta) ? $this->meta : [];

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name_ar' => $this->name_ar,
            'name_en' => $this->name_en,
            'country' => $this->country,
            'governorate' => $this->governorate,
            'type' => $this->type,
            'status' => $this->status,
            'hours_ar' => $this->hours_ar,
            'notes_ar' => $this->notes_ar,
            'phone' => $this->phone,
            'lat' => $this->lat,
            'lng' => $this->lng,
            'sort_order' => $this->sort_order,
            'meta' => $meta,
            // Backwards-compatible keys matching resources/data/crossings.json
            'n' => $meta['n'] ?? $this->sort_order,
            'name' => $this->name_ar,
            'intl' => $this->phone,
            'category' => $this->type,
            'direction' => $meta['direction'] ?? null,
            'lon' => $this->lng,
            'opType' => $meta['opType'] ?? $this->notes_ar,
            'windows' => $meta['windows'] ?? [],
            'mapsUrl' => $meta['mapsUrl'] ?? ($this->lat !== null && $this->lng !== null
                ? sprintf('https://maps.google.com/?q=%s,%s', $this->lat, $this->lng)
                : null),
            'openingSoon' => (bool) ($meta['openingSoon'] ?? ($this->status === 'opening_soon')),
            'override' => $meta['override'] ?? null,
        ];
    }

    /**
     * Graceful fallback to resources/data/crossings.json when the DB table is
     * empty or not yet migrated during a zero-downtime rollout.
     *
     * @return array{meta: array<string, mixed>, crossings: list<array<string, mixed>>}
     */
    public static function fromJsonFallback(): array
    {
        $path = resource_path('data/crossings.json');
        if (! is_file($path)) {
            return ['meta' => [], 'crossings' => []];
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        if (! is_array($decoded)) {
            return ['meta' => [], 'crossings' => []];
        }

        $rows = [];
        foreach ($decoded['crossings'] ?? [] as $index => $item) {
            if (! is_array($item) || empty($item['slug'])) {
                continue;
            }

            $windows = is_array($item['windows'] ?? null) ? $item['windows'] : [];
            $openingSoon = (bool) ($item['openingSoon'] ?? false);
            $override = is_array($item['override'] ?? null) ? $item['override'] : null;

            $status = $openingSoon
                ? 'opening_soon'
                : (string) ($override['status'] ?? 'open');

            $rows[] = [
                'id' => null,
                'slug' => (string) $item['slug'],
                'name_ar' => (string) ($item['name'] ?? ''),
                'name_en' => null,
                'country' => $item['country'] ?? null,
                'governorate' => null,
                'type' => (string) ($item['category'] ?? 'crossing'),
                'status' => $status,
                'hours_ar' => self::formatWindowsAr($windows),
                'notes_ar' => $item['opType'] ?? null,
                'phone' => isset($item['intl']) ? (string) $item['intl'] : null,
                'lat' => isset($item['lat']) ? (float) $item['lat'] : null,
                'lng' => isset($item['lon']) ? (float) $item['lon'] : null,
                'sort_order' => (int) ($item['n'] ?? ($index + 1)),
                'meta' => [
                    'n' => $item['n'] ?? ($index + 1),
                    'direction' => $item['direction'] ?? null,
                    'opType' => $item['opType'] ?? null,
                    'windows' => $windows,
                    'mapsUrl' => $item['mapsUrl'] ?? null,
                    'openingSoon' => $openingSoon,
                    'override' => $override,
                ],
                'n' => $item['n'] ?? ($index + 1),
                'name' => (string) ($item['name'] ?? ''),
                'intl' => isset($item['intl']) ? (string) $item['intl'] : null,
                'category' => (string) ($item['category'] ?? 'crossing'),
                'direction' => $item['direction'] ?? null,
                'lon' => isset($item['lon']) ? (float) $item['lon'] : null,
                'opType' => $item['opType'] ?? null,
                'windows' => $windows,
                'mapsUrl' => $item['mapsUrl'] ?? null,
                'openingSoon' => $openingSoon,
                'override' => $override,
            ];
        }

        return [
            'meta' => is_array($decoded['meta'] ?? null) ? $decoded['meta'] : [],
            'crossings' => $rows,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $windows
     */
    public static function formatWindowsAr(array $windows): ?string
    {
        if ($windows === []) {
            return null;
        }

        $parts = [];
        foreach ($windows as $win) {
            if (! is_array($win)) {
                continue;
            }
            $label = ! empty($win['label']) ? trim((string) $win['label']).': ' : '';
            if (! empty($win['h24'])) {
                $parts[] = $label.'على مدار الساعة';
            } elseif (! empty($win['start']) && ! empty($win['end'])) {
                $parts[] = $label.$win['start'].' - '.$win['end'];
            }
        }

        return $parts === [] ? null : implode(' | ', $parts);
    }
}
