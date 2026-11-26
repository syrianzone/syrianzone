<?php

namespace App\Services\IndexNow;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Queues canonical public URLs in cache and submits them to IndexNow in batches.
 *
 * Active only when explicitly enabled, a key is configured, and the app is
 * running in production, so local/staging/test writes never ping search engines.
 */
class IndexNow
{
    public const CACHE_KEY = 'indexnow:pending_urls';

    private const LOCK_KEY = 'indexnow:pending_urls:lock';

    public const MAX_BATCH_SIZE = 10000;

    private const QUEUE_TTL_DAYS = 7;

    public function isEnabled(): bool
    {
        if (! app()->environment('production')) {
            return false;
        }

        if (! (bool) config('seo.indexnow.enabled', false)) {
            return false;
        }

        return $this->key() !== '';
    }

    public function key(): string
    {
        return trim((string) config('seo.indexnow.key', ''));
    }

    /**
     * Queue one or more paths or canonical URLs for the next flush.
     *
     * @param  string|array<int, string>  $paths
     */
    public function queue(string|array $paths): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $urls = $this->normalizeMany((array) $paths);
        if ($urls === []) {
            return;
        }

        $this->withLock(function () use ($urls): void {
            $existing = $this->readQueue();
            $merged = array_values(array_unique(array_merge($existing, $urls)));
            $this->writeQueue($merged);
        });
    }

    /**
     * Current queued canonical URLs awaiting submission.
     *
     * @return list<string>
     */
    public function pending(): array
    {
        return $this->readQueue();
    }

    /**
     * Submit queued URLs to IndexNow in chunks of up to 10,000.
     *
     * URLs are kept in the queue on 5xx responses, 429 rate-limits, or
     * connection failures so the next scheduled run can retry them.
     *
     * @return array{submitted: int, kept: int, batches: int}
     */
    public function flush(): array
    {
        if (! $this->isEnabled()) {
            return ['submitted' => 0, 'kept' => 0, 'batches' => 0];
        }

        /** @var list<string> $urls */
        $urls = $this->withLock(function (): array {
            $queued = $this->readQueue();
            if ($queued !== []) {
                Cache::forget(self::CACHE_KEY);
            }

            return $queued;
        });

        if ($urls === []) {
            return ['submitted' => 0, 'kept' => 0, 'batches' => 0];
        }

        $endpoint = trim((string) config('seo.indexnow.endpoint', 'https://api.indexnow.org/indexnow'));
        $baseUrl = $this->baseUrl();
        $host = $this->canonicalHost($baseUrl);
        $key = $this->key();

        if ($host === '' || $endpoint === '') {
            $this->requeue($urls);

            return ['submitted' => 0, 'kept' => count($urls), 'batches' => 0];
        }

        $keyLocation = $baseUrl.'/'.rawurlencode($key).'.txt';

        $submitted = 0;
        $kept = [];
        $batches = 0;
        $chunks = array_chunk($urls, self::MAX_BATCH_SIZE);

        foreach ($chunks as $index => $chunk) {
            $batches++;

            try {
                $response = Http::timeout(15)
                    ->acceptJson()
                    ->asJson()
                    ->post($endpoint, [
                        'host' => $host,
                        'key' => $key,
                        'keyLocation' => $keyLocation,
                        'urlList' => array_values($chunk),
                    ]);

                $status = $response->status();

                if ($response->successful()) {
                    $submitted += count($chunk);
                    Log::info('IndexNow batch submitted', [
                        'status' => $status,
                        'count' => count($chunk),
                    ]);

                    continue;
                }

                if ($status === 429 || $status >= 500) {
                    Log::warning('IndexNow batch deferred for retry', [
                        'status' => $status,
                        'count' => count($chunk),
                    ]);

                    foreach (array_slice($chunks, $index) as $remainingChunk) {
                        array_push($kept, ...$remainingChunk);
                    }

                    break;
                }

                Log::warning('IndexNow batch rejected', [
                    'status' => $status,
                    'count' => count($chunk),
                    'body' => mb_substr($response->body(), 0, 500),
                ]);
            } catch (ConnectionException $e) {
                Log::warning('IndexNow batch connection failed, keeping URLs', [
                    'error' => $e->getMessage(),
                    'count' => count($chunk),
                ]);

                foreach (array_slice($chunks, $index) as $remainingChunk) {
                    array_push($kept, ...$remainingChunk);
                }

                break;
            }
        }

        if ($kept !== []) {
            $this->requeue($kept);
        }

        return [
            'submitted' => $submitted,
            'kept' => count($kept),
            'batches' => $batches,
        ];
    }

    /**
     * Normalize a relative path or absolute URL into a canonical URL on the
     * configured SEO host, or null if blank/foreign.
     */
    public function canonicalUrl(string $path): ?string
    {
        $trimmed = trim($path);
        if ($trimmed === '') {
            return null;
        }

        $baseUrl = $this->baseUrl();
        $canonicalHost = strtolower($this->canonicalHost($baseUrl));

        if (preg_match('#^https?://#i', $trimmed) === 1) {
            $parsedHost = strtolower((string) parse_url($trimmed, PHP_URL_HOST));
            if ($parsedHost === '' || $parsedHost !== $canonicalHost) {
                return null;
            }

            return $trimmed;
        }

        $normalizedPath = '/'.ltrim($trimmed, '/');
        if ($normalizedPath === '/') {
            return $baseUrl.'/';
        }

        return $baseUrl.$this->encodePath($normalizedPath);
    }

    /**
     * @param  array<int, string>  $paths
     * @return list<string>
     */
    private function normalizeMany(array $paths): array
    {
        $normalized = [];

        foreach ($paths as $path) {
            if (! is_string($path)) {
                continue;
            }

            $url = $this->canonicalUrl($path);
            if ($url !== null) {
                $normalized[] = $url;
            }
        }

        return array_values(array_unique($normalized));
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('seo.base_url'), '/');
    }

    private function canonicalHost(string $baseUrl): string
    {
        $host = (string) parse_url($baseUrl, PHP_URL_HOST);
        $port = parse_url($baseUrl, PHP_URL_PORT);

        return $port ? $host.':'.$port : $host;
    }

    private function encodePath(string $path): string
    {
        return implode('/', array_map(
            static fn (string $segment): string => rawurlencode(rawurldecode($segment)),
            explode('/', $path),
        ));
    }

    /**
     * @param  list<string>  $urls
     */
    private function requeue(array $urls): void
    {
        if ($urls === []) {
            return;
        }

        $this->withLock(function () use ($urls): void {
            $existing = $this->readQueue();
            $merged = array_values(array_unique(array_merge($urls, $existing)));
            $this->writeQueue($merged);
        });
    }

    /**
     * @return list<string>
     */
    private function readQueue(): array
    {
        $cached = Cache::get(self::CACHE_KEY, []);
        if (! is_array($cached)) {
            return [];
        }

        return array_values(array_filter($cached, fn (mixed $item): bool => is_string($item) && $item !== ''));
    }

    /**
     * @param  list<string>  $urls
     */
    private function writeQueue(array $urls): void
    {
        if ($urls === []) {
            Cache::forget(self::CACHE_KEY);

            return;
        }

        Cache::put(self::CACHE_KEY, $urls, now()->addDays(self::QUEUE_TTL_DAYS));
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    private function withLock(callable $callback): mixed
    {
        return Cache::lock(self::LOCK_KEY, 5)->block(5, $callback);
    }
}
