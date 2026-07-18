<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('backup:clean')->daily()->at('01:00');
Schedule::command('backup:run --only-db')->everySixHours();
Schedule::command('guess-who:prune-expired-sessions')->everyFifteenMinutes();
Schedule::command('population:update-climate')->hourly();
Schedule::command('polls:prune-private-data')->dailyAt('02:00');
Schedule::command('tierlist:post-rank-changes')->dailyAt('09:00')->timezone('Asia/Damascus')->withoutOverlapping();
