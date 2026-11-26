<?php

namespace App\Console\Commands;

use App\Services\IndexNow\IndexNow;
use App\Services\Sitemap\SitemapBuilder;
use App\Services\Sitemap\SitemapUrl;
use Illuminate\Console\Command;

/**
 * Flush queued IndexNow URLs, submit explicit paths, or push the entire
 * sitemap (`--all`) in chunks of up to 10,000 URLs.
 */
class IndexNowSubmit extends Command
{
    protected $signature = 'indexnow:submit
        {--all : Submit every URL from the XML sitemap}
        {path?* : Specific relative paths or canonical URLs to submit}';

    protected $description = 'Submit queued or specified URLs to IndexNow';

    public function handle(IndexNow $indexNow, SitemapBuilder $sitemapBuilder): int
    {
        if (! $indexNow->isEnabled()) {
            $this->info('IndexNow is disabled (requires INDEXNOW_ENABLED=true, INDEXNOW_KEY, and production environment).');

            return self::SUCCESS;
        }

        if ($this->option('all')) {
            $paths = array_map(fn (SitemapUrl $url): string => $url->path, $sitemapBuilder->build());
            $indexNow->queue($paths);
        } else {
            /** @var list<string> $paths */
            $paths = array_values(array_filter((array) $this->argument('path'), 'is_string'));
            if ($paths !== []) {
                $indexNow->queue($paths);
            }
        }

        $result = $indexNow->flush();

        $this->info(sprintf(
            'IndexNow flush complete: submitted=%d kept=%d batches=%d',
            $result['submitted'],
            $result['kept'],
            $result['batches'],
        ));

        return self::SUCCESS;
    }
}
