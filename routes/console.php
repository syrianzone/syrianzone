<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('guess-who:prune-expired-sessions')->everyFifteenMinutes();
Schedule::command('media:cleanup')->everyMinute()->onOneServer()->withoutOverlapping();
Schedule::command('places:reprocess-photos --pending --limit=100')->everyMinute()->onOneServer()->withoutOverlapping();
Schedule::command('polls:prune-private-data')->dailyAt('02:00');
Schedule::command('tierlist:post-rank-changes')->dailyAt('09:00')->timezone('Asia/Damascus')->withoutOverlapping();

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
