<?php

namespace Database\Seeders;

use Database\Seeders\Staging\StagingContributorsSeeder;
use Database\Seeders\Staging\StagingGuessWhoSeeder;
use Database\Seeders\Staging\StagingPlacesSeeder;
use Database\Seeders\Staging\StagingPollsSeeder;
use Database\Seeders\Staging\StagingTransitSeeder;
use Database\Seeders\Staging\StagingUsersSeeder;
use Illuminate\Database\Seeder;

/**
 * Demo data for the staging environment. Run at container boot by
 * docker/10-startup.sh, but only when APP_ENV=staging.
 *
 * Every module is Faker-free and deterministic: see Staging/StagingSeed.php for
 * why (short version: the production image has no dev dependencies, and staging
 * runs that same image on purpose).
 *
 * The modules are independent. One of them blowing up should not cost you the
 * other five, so failures are caught, reported loudly, and stepped over. A
 * half-seeded staging box is still a usable staging box; a boot loop is not.
 */
class StagingSeeder extends Seeder
{
    /** Order matters only for the first entry: everything else hangs off the users. */
    private const MODULES = [
        StagingUsersSeeder::class,
        StagingPlacesSeeder::class,
        StagingPollsSeeder::class,
        StagingTransitSeeder::class,
        StagingGuessWhoSeeder::class,
        StagingContributorsSeeder::class,
    ];

    public function run(): void
    {
        // The guard that matters. This seeder writes fake users, fake places and
        // fake ballots; running it against production would be unrecoverable
        // without a restore. Refuse rather than trust the caller.
        if (app()->environment('production')) {
            throw new \RuntimeException('StagingSeeder refuses to run with APP_ENV=production.');
        }

        $out = $this->command?->getOutput();
        $out?->writeln('<info>seeding staging demo data</info>');

        $failed = [];
        foreach (self::MODULES as $module) {
            $short = class_basename($module);
            try {
                $out?->writeln("<comment>› {$short}</comment>");
                $this->call($module);
            } catch (\Throwable $e) {
                // honest in the record: say which module broke and why, keep going.
                $failed[] = $short;
                $out?->writeln("<error>✗ {$short} failed: {$e->getMessage()}</error>");
                report($e);
            }
        }

        $failed
          ? $out?->writeln('<error>staging seed finished with failures: '.implode(', ', $failed).'</error>')
          : $out?->writeln('<info>staging seed complete</info>');
    }
}
