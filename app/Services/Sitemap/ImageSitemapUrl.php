<?php

namespace App\Services\Sitemap;

/**
 * One page entry in the image sitemap: a site-relative `$path` and the list
 * of image URLs or site-relative paths rendered on that page.
 */
final class ImageSitemapUrl
{
    /**
     * @param  list<string>  $images
     */
    public function __construct(
        public readonly string $path,
        public readonly array $images,
    ) {}
}
