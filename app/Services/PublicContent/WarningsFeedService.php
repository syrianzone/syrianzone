<?php

declare(strict_types=1);

namespace App\Services\PublicContent;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Emergency warnings come from jard's news aggregator, which mirrors the
 * ministry CAP feed but exposes no JSON API. Its Inertia page embeds the
 * props as HTML-escaped JSON in a data-page attribute, so one plain GET and
 * a regex are enough and no Inertia version handshake is needed. Items are
 * kept by feed category rather than feed id so new warning feeds appear
 * without a deploy. A short cache keeps the upstream quiet; a long-lived
 * last-good copy keeps the app informed through outages, flagged as stale.
 */
final class WarningsFeedService
{
    public const SOURCE_URL = 'https://news.jard.chat/?category=warnings&tab=all';

    public const CACHE_KEY = 'mobile:warnings';

    public const LAST_GOOD_KEY = 'mobile:warnings:last-good';

    private const CACHE_TTL = 300;

    private const LAST_GOOD_TTL = 7 * 24 * 3600;

    private const MAX_ITEMS = 50;

    private const DEFAULT_COLOR = '#ef4444';

    /**
     * @return array{items: list<array<string, mixed>>, fetched_at: string, stale: bool}
     *
     * @throws RuntimeException when the upstream fails and nothing is cached
     */
    public function latest(): array
    {
        $fresh = Cache::get(self::CACHE_KEY);
        if (is_array($fresh)) {
            return [...$fresh, 'stale' => false];
        }

        try {
            $response = Http::timeout(10)->get(self::SOURCE_URL);
            if (! $response->successful()) {
                throw new RuntimeException("Upstream responded with status {$response->status()}.");
            }

            $payload = [
                'items' => self::parse($response->body()),
                'fetched_at' => now()->utc()->toIso8601String(),
            ];
            Cache::put(self::CACHE_KEY, $payload, self::CACHE_TTL);
            Cache::put(self::LAST_GOOD_KEY, $payload, self::LAST_GOOD_TTL);

            return [...$payload, 'stale' => false];
        } catch (Throwable $error) {
            Log::warning('Failed to fetch emergency warnings.', ['error' => $error->getMessage()]);

            $lastGood = Cache::get(self::LAST_GOOD_KEY);
            if (is_array($lastGood)) {
                return [...$lastGood, 'stale' => true];
            }

            throw new RuntimeException('Emergency warnings are unavailable.', 0, $error);
        }
    }

    /**
     * Pure so tests can feed it a saved page.
     *
     * @return list<array<string, mixed>>
     */
    public static function parse(string $html): array
    {
        if (preg_match('/data-page="([^"]+)"/', $html, $match) !== 1) {
            throw new RuntimeException('No Inertia page data found.');
        }

        $page = json_decode(
            html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        $rows = $page['props']['items']['data'] ?? null;
        if (! is_array($rows)) {
            throw new RuntimeException('Page data has no warning items.');
        }

        $items = [];
        foreach ($rows as $row) {
            $item = self::normalize($row);
            if ($item !== null) {
                $items[] = $item;
            }
        }
        usort($items, fn (array $a, array $b): int => $b['published_at'] <=> $a['published_at']);

        return array_slice($items, 0, self::MAX_ITEMS);
    }

    /** @return array<string, mixed>|null */
    private static function normalize(mixed $row): ?array
    {
        if (! is_array($row) || ! is_array($row['feed'] ?? null)) {
            return null;
        }
        $feed = $row['feed'];
        $title = trim((string) ($row['title'] ?? ''));
        $id = $row['id'] ?? null;
        if (($feed['category'] ?? null) !== 'warnings' || $title === '' || $id === null) {
            return null;
        }

        try {
            $publishedAt = CarbonImmutable::parse((string) ($row['pub_date'] ?? ''))->utc();
        } catch (Throwable) {
            return null;
        }

        return [
            'id' => (string) $id,
            'title' => $title,
            'description' => trim((string) ($row['description'] ?? '')),
            'link' => (string) ($row['link'] ?? ''),
            'published_at' => $publishedAt->toIso8601String(),
            'source' => [
                'name' => (string) ($feed['name'] ?? ''),
                'slug' => (string) ($feed['slug'] ?? ''),
                'color' => (string) ($feed['color'] ?? self::DEFAULT_COLOR),
            ],
        ];
    }
}
