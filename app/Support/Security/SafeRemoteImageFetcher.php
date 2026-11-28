<?php

namespace App\Support\Security;

use Illuminate\Support\Facades\Http;

/**
 * SSRF-hardened remote image fetcher for server-side logo/avatar/portrait ingestion.
 *
 * Enforces HTTPS-only URLs, resolves DNS and rejects loopback/private/reserved
 * IPv4 & IPv6 addresses, disables HTTP redirects, bounds timeouts and body size,
 * and validates the downloaded payload's raster image header and pixel count.
 */
class SafeRemoteImageFetcher
{
    public const MAX_BYTES = 8 * 1024 * 1024;

    public const MAX_PIXELS = 24_000_000;

    /** @var list<int> */
    private const ALLOWED_TYPES = [
        IMAGETYPE_JPEG,
        IMAGETYPE_PNG,
        IMAGETYPE_WEBP,
        IMAGETYPE_GIF,
    ];

    /**
     * Fetch a remote HTTPS image and return its validated raw bytes, or null if
     * the URL is disallowed, unreachable, too large, or not a supported raster image.
     */
    public function fetch(string $url): ?string
    {
        $trimmed = trim($url);
        if (! $this->isSafeUrl($trimmed)) {
            return null;
        }

        try {
            $response = Http::connectTimeout(3)
                ->timeout(8)
                ->withoutRedirecting()
                ->withUserAgent('Mozilla/5.0 (compatible; SyrianZoneBot/1.0)')
                ->withOptions([
                    'progress' => static function ($total, $downloaded): void {
                        if ($total > self::MAX_BYTES || $downloaded > self::MAX_BYTES) {
                            throw new \RuntimeException('Remote image exceeds the maximum allowed size.');
                        }
                    },
                ])
                ->get($trimmed);
        } catch (\Throwable) {
            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $bytes = $response->body();
        if ($bytes === '' || strlen($bytes) > self::MAX_BYTES) {
            return null;
        }

        return $this->isValidImageBytes($bytes) ? $bytes : null;
    }

    public function isSafeUrl(string $url): bool
    {
        if ($url === '') {
            return false;
        }

        $parts = parse_url($url);
        if (! is_array($parts)) {
            return false;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');
        if ($scheme !== 'https' || $host === '') {
            return false;
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            return false;
        }

        if (isset($parts['port']) && (int) $parts['port'] !== 443) {
            return false;
        }

        $ips = $this->resolveHostIps($host);
        if ($ips === []) {
            return false;
        }

        foreach ($ips as $ip) {
            if (! $this->isPublicIp($ip)) {
                return false;
            }
        }

        return true;
    }

    public function isValidImageBytes(string $bytes): bool
    {
        $info = @getimagesizefromstring($bytes);
        if (
            $info === false
            || ! isset($info[0], $info[1], $info[2])
            || ! in_array($info[2], self::ALLOWED_TYPES, true)
        ) {
            return false;
        }

        $width = (int) $info[0];
        $height = (int) $info[1];

        return $width > 0 && $height > 0 && ($width * $height) <= self::MAX_PIXELS;
    }

    /**
     * @return list<string>
     */
    protected function resolveHostIps(string $host): array
    {
        $cleanHost = trim($host, '[]');

        if (filter_var($cleanHost, FILTER_VALIDATE_IP) !== false) {
            return [$cleanHost];
        }

        $ips = [];

        if (function_exists('dns_get_record')) {
            $records = @dns_get_record($cleanHost, DNS_A | DNS_AAAA);
            if (is_array($records)) {
                foreach ($records as $record) {
                    if (isset($record['ip']) && is_string($record['ip'])) {
                        $ips[] = $record['ip'];
                    } elseif (isset($record['ipv6']) && is_string($record['ipv6'])) {
                        $ips[] = $record['ipv6'];
                    }
                }
            }
        }

        if ($ips === []) {
            $fallback = @gethostbynamel($cleanHost);
            if (is_array($fallback)) {
                $ips = $fallback;
            }
        }

        return array_values(array_unique($ips));
    }

    protected function isPublicIp(string $ip): bool
    {
        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) !== false;
    }
}
