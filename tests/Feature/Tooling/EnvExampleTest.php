<?php

/**
 * `.env.example` is the file a new environment is built from. `config/*.php`
 * reads far more keys than it documented, and a reader could not tell a project
 * switch from a Laravel skeleton default. This test collects every `env('KEY'`
 * in config/ (plus the API prefix bootstrap/app.php reads) and requires each to
 * appear in .env.example — documented, commented out, no value needed.
 *
 * Adding a key to a config file therefore means either documenting it or adding
 * it to FRAMEWORK_KEYS below with the reason it stays Laravel's own default.
 */

/**
 * Laravel skeleton keys, read only by config files this project does not
 * configure (database drivers, cache/queue/session stores, mail, logging, the
 * search and broadcast stacks the app does not use). They are documented by
 * Laravel's own .env.example; listing them here is what keeps the two apart.
 */
const FRAMEWORK_KEYS = [
    'ABLY_KEY', 'ALGOLIA_APP_ID', 'ALGOLIA_SECRET', 'AUTH_GUARD', 'AUTH_MODEL', 'AUTH_PASSWORD_BROKER',
    'AUTH_PASSWORD_RESET_TOKEN_TABLE', 'AUTH_PASSWORD_TIMEOUT', 'AWS_ENDPOINT', 'AWS_URL', 'BEANSTALKD_QUEUE', 'BEANSTALKD_QUEUE_HOST',
    'BEANSTALKD_QUEUE_RETRY_AFTER', 'DB_CACHE_CONNECTION', 'DB_CACHE_LOCK_CONNECTION', 'DB_CACHE_LOCK_TABLE', 'DB_CACHE_TABLE', 'DB_CHARSET',
    'DB_COLLATION', 'DB_ENCRYPT', 'DB_FOREIGN_KEYS', 'DB_QUEUE', 'DB_QUEUE_CONNECTION', 'DB_QUEUE_RETRY_AFTER',
    'DB_QUEUE_TABLE', 'DB_SOCKET', 'DB_TRUST_SERVER_CERTIFICATE', 'DB_URL', 'DYNAMODB_CACHE_TABLE', 'DYNAMODB_ENDPOINT',
    'LOG_DAILY_DAYS', 'LOG_DEPRECATIONS_TRACE', 'LOG_PAPERTRAIL_HANDLER', 'LOG_SLACK_EMOJI', 'LOG_SLACK_USERNAME', 'LOG_SLACK_WEBHOOK_URL',
    'LOG_STDERR_FORMATTER', 'LOG_SYSLOG_FACILITY', 'MAIL_EHLO_DOMAIN', 'MAIL_LOG_CHANNEL', 'MAIL_SENDMAIL_PATH', 'MAIL_URL',
    'MEILISEARCH_HOST', 'MEILISEARCH_KEY', 'MEMCACHED_PASSWORD', 'MEMCACHED_PERSISTENT_ID', 'MEMCACHED_PORT', 'MEMCACHED_USERNAME',
    'MYSQL_ATTR_SSL_CA', 'PAPERTRAIL_PORT', 'PAPERTRAIL_URL', 'POSTMARK_MESSAGE_STREAM_ID', 'POSTMARK_TOKEN', 'PUSHER_APP_CLUSTER',
    'PUSHER_APP_ID', 'PUSHER_APP_KEY', 'PUSHER_APP_SECRET', 'PUSHER_HOST', 'PUSHER_PORT', 'PUSHER_SCHEME',
    'QUEUE_FAILED_DRIVER', 'REDIS_CACHE_CONNECTION', 'REDIS_CACHE_DB', 'REDIS_CACHE_LOCK_CONNECTION', 'REDIS_CLUSTER', 'REDIS_DB',
    'REDIS_PREFIX', 'REDIS_QUEUE', 'REDIS_QUEUE_CONNECTION', 'REDIS_QUEUE_RETRY_AFTER', 'REDIS_TIMEOUT', 'REDIS_URL',
    'REDIS_USERNAME', 'RESEND_KEY', 'REVERB_APP_ACCEPT_CLIENT_EVENTS_FROM', 'REVERB_APP_ACTIVITY_TIMEOUT', 'REVERB_APP_MAX_CONNECTIONS', 'REVERB_APP_MAX_MESSAGE_SIZE',
    'REVERB_APP_PING_INTERVAL', 'REVERB_APP_RATE_LIMITING_ENABLED', 'REVERB_APP_RATE_LIMIT_DECAY_SECONDS', 'REVERB_APP_RATE_LIMIT_MAX_ATTEMPTS', 'REVERB_APP_RATE_LIMIT_TERMINATE', 'REVERB_MAX_REQUEST_SIZE',
    'REVERB_PULSE_INGEST_INTERVAL', 'REVERB_SCALING_CHANNEL', 'REVERB_SCALING_ENABLED', 'REVERB_SERVER', 'REVERB_SERVER_PATH', 'REVERB_TELESCOPE_INGEST_INTERVAL',
    'SANCTUM_TOKEN_PREFIX', 'SCOUT_DRIVER', 'SCOUT_IDENTIFY', 'SCOUT_PREFIX', 'SCOUT_QUEUE', 'SESSION_CONNECTION',
    'SESSION_COOKIE', 'SESSION_EXPIRE_ON_CLOSE', 'SESSION_HTTP_ONLY', 'SESSION_PARTITIONED_COOKIE', 'SESSION_SAME_SITE', 'SESSION_STORE',
    'SESSION_TABLE', 'SLACK_BOT_USER_DEFAULT_CHANNEL', 'SLACK_BOT_USER_OAUTH_TOKEN', 'SQS_PREFIX', 'SQS_QUEUE', 'SQS_SUFFIX',
    'TYPESENSE_API_KEY', 'TYPESENSE_CONNECTION_TIMEOUT_SECONDS', 'TYPESENSE_HEALTHCHECK_INTERVAL_SECONDS', 'TYPESENSE_HOST', 'TYPESENSE_IMPORT_ACTION', 'TYPESENSE_MAX_TOTAL_RESULTS',
    'TYPESENSE_NUM_RETRIES', 'TYPESENSE_PATH', 'TYPESENSE_PORT', 'TYPESENSE_PROTOCOL', 'TYPESENSE_RETRY_INTERVAL_SECONDS',
];

/** Every env() key the application's configuration reads. */
function configuredEnvKeys(): array
{
    $keys = [];

    foreach (glob(config_path('*.php')) as $file) {
        preg_match_all('/env\(\s*[\'"]([A-Z0-9_]+)[\'"]/', (string) file_get_contents($file), $matches);
        foreach ($matches[1] as $key) {
            $keys[$key] = true;
        }
    }

    // bootstrap/app.php reads the API prefix that every client depends on.
    preg_match_all('/env\(\s*[\'"]([A-Z0-9_]+)[\'"]/', (string) file_get_contents(base_path('bootstrap/app.php')), $matches);
    foreach ($matches[1] as $key) {
        $keys[$key] = true;
    }

    return array_keys($keys);
}

test('every key config/ reads is documented in .env.example', function () {
    $example = (string) file_get_contents(base_path('.env.example'));
    $undocumented = [];

    foreach (configuredEnvKeys() as $key) {
        if (in_array($key, FRAMEWORK_KEYS, true)) {
            continue;
        }
        // A line is documentation whether or not it is commented out, and may
        // be shown without a value.
        if (! preg_match('/^\s*#?\s*'.preg_quote($key, '/').'=/m', $example)) {
            $undocumented[] = $key;
        }
    }

    sort($undocumented);

    expect($undocumented)->toBe(
        [],
        'config/*.php reads these keys and .env.example does not document them. '
        .'Add a commented `# KEY=` line with a one-line description, or list it in FRAMEWORK_KEYS: '
        .implode(', ', $undocumented),
    );
});

test('the framework allowlist only names keys a framework config file reads', function () {
    $configured = configuredEnvKeys();

    foreach (FRAMEWORK_KEYS as $key) {
        expect($configured)->toContain($key);
    }
});
