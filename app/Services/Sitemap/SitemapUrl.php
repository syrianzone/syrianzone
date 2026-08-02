<?php

namespace App\Services\Sitemap;

use Illuminate\Support\Carbon;

/**
 * One entry in the sitemap. `$path` is site-relative — the writer is what knows
 * the canonical host — and `$lastmod` is null for pages whose freshness cannot
 * be derived from content.
 */
final class SitemapUrl
{
    public function __construct(
        public readonly string $path,
        public readonly float $priority,
        public readonly string $changefreq,
        public readonly ?Carbon $lastmod = null,
    ) {}
}
