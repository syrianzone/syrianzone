<?php

namespace App\Support\Seo\Preview;

/**
 * What a database-backed page says about itself in search results and link
 * previews. Built by a PreviewResolver; turned into tags by SeoMeta.
 */
final readonly class Preview
{
    /**
     * @param  string  $canonicalPath  path for <link rel="canonical">
     * @param  string  $image  site-relative URL of the share card
     * @param  array{0:string,1:string}|null  $parent  breadcrumb parent as [path, label]
     * @param  string|null  $sharePath  path and query for og:url when the shared
     *                                  link is narrower than the canonical page
     *                                  (a record opened through a query string)
     */
    public function __construct(
        public string $title,
        public string $description,
        public string $canonicalPath,
        public string $image,
        public string $type = 'website',
        public bool $noindex = false,
        public string $schema = 'WebPage',
        public ?array $parent = null,
        public ?string $sharePath = null,
    ) {}
}
