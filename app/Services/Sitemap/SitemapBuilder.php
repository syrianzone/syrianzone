<?php

namespace App\Services\Sitemap;

use App\Models\Candidate;
use App\Models\City;
use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\Place;
use App\Models\Poll;
use App\Models\Promise;
use App\Models\Route as TransitRoute;
use App\Services\ExternalData\ExternalSheetCache;
use App\Support\Seo\Pages;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Decides which URLs belong in the sitemap and how fresh each one is. Knows the
 * site's page inventory; knows nothing about XML or HTTP.
 */
class SitemapBuilder
{
    /**
     * @return SitemapUrl[]
     */
    public function build(): array
    {
        $urls = array_merge(
            $this->staticUrls(),
            $this->pollUrls(),
            $this->promiseUrls(),
            $this->transitCityUrls(),
        );

        // A path reaching both a static entry and a dynamic source would split
        // that page's ranking signals across two identical <loc>s. The tier-list
        // exclusion below already prevents the one case that exists today; this
        // keeps a future page from reintroducing it silently.
        $seen = [];

        return array_values(array_filter($urls, function (SitemapUrl $url) use (&$seen) {
            if (isset($seen[$url->path])) {
                return false;
            }

            $seen[$url->path] = true;

            return true;
        }));
    }

    /**
     * The fixed pages, from the SEO page table (`resources/data/seo.json`): the
     * same records that give every page its <head>, minus the ones that opt out
     * with `"sitemap": false`. Auth-gated pages (/dashboard, /admin/*), redirect
     * shims (/places, /transit/city/{id}/map, /transit/city/{id}/route/{id}),
     * ephemeral game rooms (/guesswho/room/{code}), shared result snapshots
     * (/compass/s/{shareId}) and infrastructure routes (/healthcheck, /auth/*,
     * /dev/*) have no record there, so they never reach the sitemap.
     *
     * Carries a lastmod only where one can be derived from the content itself.
     * Google discards lastmod site-wide once it catches a sitemap reporting
     * dates that do not match the page, so pages whose freshness we cannot
     * answer for ship without the tag rather than with a deploy timestamp
     * standing in for one.
     *
     * @return SitemapUrl[]
     */
    private function staticUrls(): array
    {
        $lastmod = $this->contentLastmod();

        return array_map(
            fn (array $page) => new SitemapUrl($page[0], $page[1], $page[2], $lastmod[$page[0]] ?? null),
            Pages::sitemapPages(),
        );
    }

    /**
     * Fixed pages that are backed by a table: the newest row is an accurate
     * answer to "when did this page last change". Pages absent from this map
     * are emitted without a lastmod.
     *
     * @return array<string, Carbon>
     */
    private function contentLastmod(): array
    {
        $tierListPoll = Poll::where('slug', Poll::coreSlug())->first();

        return array_filter([
            '/govapps' => $this->latestOf([GovApp::max('updated_at')]),
            '/phonebook' => $this->latestOf([
                PhonebookEntry::max('updated_at'),
                PhonebookCategory::max('updated_at'),
            ]),
            '/syofficial' => $this->latestOf([
                OfficialEntity::max('updated_at'),
                OfficialCategory::max('updated_at'),
            ]),
            // Only approved places reach the public map, so pending and rejected
            // submissions must not move this page's lastmod.
            '/mishwar' => $this->latestOf([
                Place::where('status', 'approved')->max('updated_at'),
            ]),
            '/polls' => $this->latestOf([Poll::where('is_active', true)->max('updated_at')]),
            // Only published promises are public, so the review queue must not
            // move this page's lastmod.
            '/promises' => $this->latestOf([Promise::published()->max('updated_at')]),
            '/tierlist' => $tierListPoll ? $this->pollLastmod($tierListPoll) : null,
            '/tierlist/leaderboard' => $tierListPoll ? $this->leaderboardLastmod($tierListPoll->id) : null,
            // Sheet-backed pages: last successful fetch time, not a deploy stamp.
            '/party' => $this->sheetTime(ExternalSheetCache::PARTY),
            '/sites' => $this->sheetTime(ExternalSheetCache::SITES),
        ]);
    }

    private function sheetTime(string $sheet): ?Carbon
    {
        try {
            $fetchedAt = ExternalSheetCache::fetchedAt($sheet);

            return $fetchedAt ? Carbon::parse($fetchedAt) : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * One entry per active poll, plus its leaderboard. The tier-list poll is
     * skipped because /tierlist already covers it.
     *
     * @return SitemapUrl[]
     */
    private function pollUrls(): array
    {
        $polls = Poll::where('is_active', true)
            ->whereNotNull('slug')
            ->where('slug', '!=', Poll::coreSlug())
            ->get();

        $urls = [];

        foreach ($polls as $poll) {
            $urls[] = new SitemapUrl('/polls/'.$poll->slug, 0.7, 'weekly', $this->pollLastmod($poll));
            $urls[] = new SitemapUrl(
                '/polls/'.$poll->slug.'/leaderboard',
                0.6,
                'daily',
                $this->leaderboardLastmod($poll->id)
            );
        }

        return $urls;
    }

    /**
     * One entry per published promise. Unpublished and rejected suggestions
     * 404, so they must never be listed.
     *
     * @return SitemapUrl[]
     */
    private function promiseUrls(): array
    {
        return Promise::published()
            ->orderBy('number')
            ->get(['number', 'updated_at'])
            ->map(fn (Promise $p) => new SitemapUrl('/promises/'.$p->number, 0.7, 'weekly', $p->updated_at))
            ->all();
    }

    /**
     * One entry per transit city that has something to show. A city with no
     * published routes renders an empty map, and a thin page costs more than the
     * missing URL does.
     *
     * @return SitemapUrl[]
     */
    private function transitCityUrls(): array
    {
        // The page renders the city's routes, so a newly published route changes
        // it as much as an edit to the city record does. Collected in one grouped
        // query rather than one per city.
        $routeLastmod = TransitRoute::where('status', 'published')
            ->groupBy('city_id')
            ->selectRaw('city_id, MAX(updated_at) as last_updated')
            ->pluck('last_updated', 'city_id');

        // Only the two columns are selected: cities carry PostGIS geometry that
        // would otherwise be hydrated as raw bytes for nothing.
        return City::where('status', 'active')
            ->get(['id', 'updated_at'])
            ->filter(fn ($city) => $routeLastmod->has($city->id))
            ->map(fn ($city) => new SitemapUrl(
                '/transit/city/'.$city->id,
                0.8,
                'weekly',
                $this->latestOf([$city->updated_at, $routeLastmod[$city->id]])
            ))
            ->values()
            ->all();
    }

    /**
     * A poll page renders its active candidates, so either the poll record or a
     * candidate edit can change it.
     */
    private function pollLastmod(Poll $poll): ?Carbon
    {
        return $this->latestOf([
            $poll->updated_at,
            Candidate::where('poll_id', $poll->id)->where('status', 'active')->max('updated_at'),
        ]);
    }

    /**
     * Leaderboards are rendered from daily_scores, so that table's newest write
     * for the poll is the page's real change time.
     */
    private function leaderboardLastmod(string $pollId): ?Carbon
    {
        return $this->latestOf([
            DB::table('daily_scores')->where('poll_id', $pollId)->max('updated_at'),
        ]);
    }

    /**
     * Newest of the given timestamps, ignoring absent ones. Callers mix raw
     * column values and Carbon instances, so everything is normalised here. An
     * unparseable value is dropped rather than allowed to fail the whole
     * sitemap over one bad row.
     */
    private function latestOf(array $timestamps): ?Carbon
    {
        $parsed = [];

        foreach (array_filter($timestamps) as $timestamp) {
            try {
                $parsed[] = Carbon::parse($timestamp);
            } catch (\Exception) {
                // Not a usable date; the page simply ships without a lastmod.
            }
        }

        return empty($parsed) ? null : max($parsed);
    }
}
