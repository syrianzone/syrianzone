<?php

namespace App\Http\Controllers;

use App\Services\Sitemap\SitemapBuilder;
use App\Services\Sitemap\SitemapWriter;
use Illuminate\Support\Facades\Cache;

class SitemapController extends Controller
{
    /**
     * Serve the XML sitemap.
     *
     * Cached for an hour: the document is rebuilt from a dozen aggregate
     * queries, and content edits reaching crawlers an hour late costs nothing.
     * Bump the key if the document's shape changes.
     */
    public function index(SitemapBuilder $builder, SitemapWriter $writer)
    {
        $xml = Cache::remember(
            'sitemap:xml:v1',
            3600,
            fn () => $writer->render($builder->build())
        );

        return response($xml, 200)
            ->header('Content-Type', 'application/xml; charset=UTF-8')
            ->header('Cache-Control', 'public, max-age=3600');
    }
}
