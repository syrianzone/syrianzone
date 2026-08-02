<?php

namespace App\Services\Sitemap;

/**
 * Renders SitemapUrl objects into a sitemaps.org urlset document. Holds no
 * domain knowledge and touches no database, so it is testable on its own.
 */
class SitemapWriter
{
    /**
     * The base URL is a constructor argument so tests can pin it, but defaults
     * to the canonical host: staging answers on a different hostname, and a
     * sitemap built from the request host would advertise a duplicate site.
     */
    public function __construct(
        private readonly string $baseUrl = 'https://syrian.zone',
    ) {}

    /**
     * @param  SitemapUrl[]  $urls
     */
    public function render(array $urls): string
    {
        $body = '';
        foreach ($urls as $url) {
            $body .= $this->renderUrl($url);
        }

        return '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n"
            .$body
            .'</urlset>'."\n";
    }

    private function renderUrl(SitemapUrl $url): string
    {
        $loc = $this->baseUrl.$this->encodePath($url->path);

        $xml = '  <url>'."\n";
        $xml .= '    <loc>'.htmlspecialchars($loc, ENT_XML1 | ENT_QUOTES, 'UTF-8').'</loc>'."\n";

        if ($url->lastmod !== null) {
            $xml .= '    <lastmod>'.$url->lastmod->toAtomString().'</lastmod>'."\n";
        }

        $xml .= '    <changefreq>'.$url->changefreq.'</changefreq>'."\n";
        $xml .= '    <priority>'.number_format($url->priority, 1).'</priority>'."\n";
        $xml .= '  </url>'."\n";

        return $xml;
    }

    /**
     * Percent-encode each path segment. Slugs and city ids come from the
     * database, and one holding a space or non-ASCII character would otherwise
     * produce an invalid <loc>.
     */
    private function encodePath(string $path): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $path)));
    }
}
