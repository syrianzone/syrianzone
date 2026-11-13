<?php

namespace App\Console\Commands;

use App\Models\OfficialEntity;
use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Support\Facts;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * Rewrites `official_entities.socials` rows that a buggy write path stored as a
 * plain list (`["https://…", "https://…"]`) into the platform-keyed map the
 * schema, the admin form and the public tiles expect
 * (`{"facebook": "https://…"}`).
 *
 * The platform is inferred from the URL host, which is deterministic for the
 * platforms in `resources/data/social-platforms.json`; the order of the list is
 * the only remaining signal, so a platform that appears twice takes its
 * `_secondary` slot in list order.
 *
 * It only ever touches a row whose `socials` is a non-empty list, and it only
 * writes when *every* URL of that row can be mapped to a slot the vocabulary
 * has: anything ambiguous (two links for a platform with no secondary slot, a
 * URL with no recognisable host) is reported and left exactly as it was, for a
 * human to fix through the admin form. Running it again is a no-op on rows it
 * already repaired, so it is safe to re-run.
 */
class RepairSyOfficialSocials extends Command
{
    protected $signature = 'syofficial:repair-socials {--dry-run : Report what would change without writing}';

    protected $description = 'Rewrite list-shaped official_entities.socials rows into the platform-keyed map';

    /**
     * The hosts each platform key owns. A key is its own primary slot; the
     * `<key>_secondary` slot of the vocabulary takes the next URL from the same
     * platform.
     *
     * @var array<string, array<int, string>>
     */
    private const HOSTS = [
        'facebook' => ['facebook.com', 'fb.com', 'fb.me'],
        'instagram' => ['instagram.com', 'instagr.am'],
        'twitter' => ['twitter.com', 'x.com'],
        'telegram' => ['t.me', 'telegram.me', 'telegram.dog'],
        'linkedin' => ['linkedin.com', 'lnkd.in'],
        'youtube' => ['youtube.com', 'youtu.be'],
        'whatsapp' => ['wa.me', 'whatsapp.com'],
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $slots = array_column(Facts::socialPlatforms(), 'key');

        $repaired = 0;
        $skipped = 0;

        foreach (OfficialEntity::query()->select(['id', 'socials'])->orderBy('id')->cursor() as $entity) {
            $socials = $entity->socials;

            if (! is_array($socials) || $socials === [] || ! array_is_list($socials)) {
                continue;
            }

            $map = $this->inferMap($socials, $slots);

            if ($map === null) {
                $skipped++;
                $this->warn("Left alone {$entity->id}: the list cannot be mapped to platform keys without guessing.");

                continue;
            }

            if (! $dryRun) {
                $entity->socials = $map;
                $entity->save();
            }

            $repaired++;
            $this->line(sprintf(
                '%s %s: %d link(s) -> %s',
                $dryRun ? 'Would repair' : 'Repaired',
                $entity->id,
                count($socials),
                implode(', ', array_keys($map)),
            ));
        }

        if (! $dryRun && $repaired > 0) {
            Cache::forget(SyOfficialDirectoryService::CATEGORIES_CACHE_KEY);
            Cache::forget(SyOfficialDirectoryService::ENTITIES_CACHE_KEY);
        }

        $this->info(sprintf(
            '%d row(s) %s, %d left alone.',
            $repaired,
            $dryRun ? 'would be repaired' : 'repaired',
            $skipped,
        ));

        return self::SUCCESS;
    }

    /**
     * The map for one list-shaped row, or null when any entry is ambiguous.
     *
     * @param  array<int, mixed>  $socials
     * @param  array<int, string>  $slots
     * @return array<string, string>|null
     */
    private function inferMap(array $socials, array $slots): ?array
    {
        $map = [];

        foreach ($socials as $url) {
            if (! is_string($url)) {
                return null;
            }

            $platform = $this->platformFor($url);

            $slot = $platform;
            if (isset($map[$slot])) {
                $slot = $platform.'_secondary';

                if (isset($map[$slot]) || ! in_array($slot, $slots, true)) {
                    return null;
                }
            }

            if (! in_array($slot, $slots, true)) {
                return null;
            }

            $map[$slot] = trim($url);
        }

        return $map;
    }

    /** The vocabulary key a URL's host belongs to; `website` when unrecognised. */
    private function platformFor(string $url): string
    {
        $host = strtolower((string) parse_url(trim($url), PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host) ?? '';

        foreach (self::HOSTS as $platform => $domains) {
            foreach ($domains as $domain) {
                if ($host === $domain || str_ends_with($host, '.'.$domain)) {
                    return $platform;
                }
            }
        }

        return 'website';
    }
}
