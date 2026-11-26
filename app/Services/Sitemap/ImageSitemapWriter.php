<?php

namespace App\Services\Sitemap;

/**
 * Renders ImageSitemapUrl objects into a Google Image Sitemap XML document.
 * Holds no domain knowledge and touches no database.
 */
class ImageSitemapWriter
{
    public const MAX_IMAGES_PER_URL = 1000;

    private readonly string $baseUrl;

    public function __construct(?string $baseUrl = null)
    {
        $this->baseUrl = rtrim($baseUrl ?? (string) config('seo.base_url'), '/');
    }

    /**
     * @param  ImageSitemapUrl[]  $urls
     */
    public function render(array $urls): string
    {
        $body = '';
        foreach ($urls as $url) {
            $body .= $this->renderUrl($url);
        }

        return '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
            .' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'."\n"
            .$body
            .'</urlset>'."\n";
    }

    private function renderUrl(ImageSitemapUrl $url): string
    {
        $images = $this->prepareImages($url->images);
        if ($images === []) {
            return '';
        }

        $loc = $this->absoluteUrl($url->path);

        $xml = '  <url>'."\n";
        $xml .= '    <loc>'.$this->escapeXml($loc).'</loc>'."\n";

        foreach ($images as $imageLoc) {
            $xml .= '    <image:image>'."\n";
            $xml .= '      <image:loc>'.$this->escapeXml($imageLoc).'</image:loc>'."\n";
            $xml .= '    </image:image>'."\n";
        }

        $xml .= '  </url>'."\n";

        return $xml;
    }

    /**
     * @param  list<string>  $images
     * @return list<string>
     */
    private function prepareImages(array $images): array
    {
        $resolved = [];

        foreach ($images as $image) {
            $trimmed = trim($image);
            if ($trimmed === '') {
                continue;
            }

            $absolute = $this->absoluteUrl($trimmed);
            if ($absolute !== '') {
                $resolved[] = $absolute;
            }
        }

        return array_slice(array_values(array_unique($resolved)), 0, self::MAX_IMAGES_PER_URL);
    }

    private function absoluteUrl(string $pathOrUrl): string
    {
        if (str_starts_with($pathOrUrl, '//')) {
            return 'https:'.$pathOrUrl;
        }

        if (preg_match('#^https?://#i', $pathOrUrl) === 1) {
            return $pathOrUrl;
        }

        $path = '/'.ltrim($pathOrUrl, '/');
        if ($path === '/') {
            return $this->baseUrl.'/';
        }

        return $this->baseUrl.$this->encodePath($path);
    }

    private function encodePath(string $path): string
    {
        return implode('/', array_map(
            fn (string $segment): string => rawurlencode(rawurldecode($segment)),
            explode('/', $path),
        ));
    }

    private function escapeXml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
