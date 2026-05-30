<?php

return [
    'backup' => [
        'name' => env('APP_NAME', 'syrianzone'),
        'source' => [
            'files' => [
                'include' => [],
                'exclude' => [],
                'follow_links' => false,
                'ignore_unreadable_directories' => false,
                'relative_path' => null,
            ],
            'databases' => [env('DB_CONNECTION', 'pgsql')],
        ],
        'database_dump_compressor' => \Spatie\DbDumper\Compressors\GzipCompressor::class,
        'destination' => [
            'compression_method' => ZipArchive::CM_DEFAULT,
            'compression_level' => 9,
            'filename_prefix' => '',
            'disks' => ['backups'],
        ],
        'temporary_directory' => storage_path('app/backup-temp'),
        'password' => env('BACKUP_ARCHIVE_PASSWORD'),
        'encryption' => 'default',
        'tries' => 1,
        'retry_delay' => 0,
    ],
    'notifications' => [
        'notifications' => [
            \Spatie\Backup\Notifications\Notifications\BackupHasFailedNotification::class => ['discord'],
            \Spatie\Backup\Notifications\Notifications\BackupWasSuccessfulNotification::class => ['discord'],
            \Spatie\Backup\Notifications\Notifications\CleanupHasFailedNotification::class => ['discord'],
            \Spatie\Backup\Notifications\Notifications\CleanupWasSuccessfulNotification::class => ['discord'],
        ],
        'notifiable' => \Spatie\Backup\Notifications\Notifiable::class,
        'mail' => ['to' => 'backup@syrian.zone', 'from' => ['address' => 'noreply@syrian.zone', 'name' => 'Backup']],
        'slack' => ['webhook_url' => '', 'channel' => null, 'username' => null, 'icon' => null],
        'discord' => [
            'webhook_url' => env('DISCORD_BACKUP_WEBHOOK', ''),
            'username' => 'SyrianZone Backup',
            'avatar_url' => '',
        ],
    ],
    'monitor_backups' => [
        [
            'name' => env('APP_NAME', 'syrianzone'),
            'disks' => ['backups'],
            'health_checks' => [
                \Spatie\Backup\Tasks\Monitor\HealthChecks\MaximumAgeInDays::class => 1,
                \Spatie\Backup\Tasks\Monitor\HealthChecks\MaximumStorageInMegabytes::class => 50000,
            ],
        ],
    ],
    'cleanup' => [
        'strategy' => \Spatie\Backup\Tasks\Cleanup\Strategies\DefaultStrategy::class,
        'default_strategy' => [
            'keep_all_backups_for_days' => 7,
            'keep_daily_backups_for_days' => 16,
            'keep_weekly_backups_for_weeks' => 8,
            'keep_monthly_backups_for_months' => 4,
            'keep_yearly_backups_for_years' => 2,
            'delete_oldest_backups_when_using_more_megabytes_than' => 50000,
        ],
        'tries' => 1,
        'retry_delay' => 0,
    ],
];
