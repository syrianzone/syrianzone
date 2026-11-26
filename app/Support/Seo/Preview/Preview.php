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
     * @param  string|null  $shareTitle  the title a link preview shows, when it
     *                                   should differ from the document title:
     *                                   the page or record's own name, without
     *                                   the site or section suffix
     * @param  \DateTimeInterface|null  $published  when the record first became
     *                                              public, for structured data
     * @param  \DateTimeInterface|null  $modified  when its content last changed
     * @param  array<string, mixed>|null  $mainEntity  Schema.org mainEntity node (e.g. Person on ProfilePage)
     * @param  list<array{0:string,1:string}>  $parents  multi-level breadcrumb parents as [[path, label], ...] (overrides $parent when non-empty)
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
        public ?string $shareTitle = null,
        public ?\DateTimeInterface $published = null,
        public ?\DateTimeInterface $modified = null,
        public ?array $mainEntity = null,
        /** @var list<array<string, mixed>> */
        public array $extraGraph = [],
        public ?string $breadcrumbLabel = null,
        /** @var list<array{0:string,1:string}> */
        public array $parents = [],
    ) {}
}
