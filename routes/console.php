<?php

use Illuminate\Support\Facades\Schedule;

// Production only, deliberately.
//
// backup:clean applies the retention policy to every configured destination
// disk. A staging box that ever picked up R2_BACKUP_BUCKET would happily prune
// production's archives, so the schedule is gated on the environment rather
// than trusting staging's .env to stay blank forever. Belt and braces.
//
// population:update-climate is gated for a duller reason: it walks every city
// against open-meteo hourly, and a second host doing that from the same egress
// IP just risks rate-limiting the real one.
if (app()->environment('production')) {
  Schedule::command('backup:clean')->daily()->at('01:00');
  Schedule::command('backup:run --only-db')->everySixHours();
  Schedule::command('population:update-climate')->hourly();
}

// Sync hotel data from HalaSyria every 2 days at 03:00
Schedule::command('hotels:sync')->cron('0 3 */2 * *');
