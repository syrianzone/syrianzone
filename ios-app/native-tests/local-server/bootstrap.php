<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Vite;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Laravel\Socialite\Facades\Socialite;
use NativeTests\LocalServer\LocalGoogleProvider;
use Illuminate\Support\HtmlString;

// This bootstrap is loaded only by the native test scripts, never public/index.php.
$project = dirname(__DIR__, 3);
$runtime = $project.'/ios-app/.expo/local-fixture';
if (! is_file($runtime.'/.env') || ! is_file($runtime.'/fixture-marker')) {
    throw new RuntimeException('Run the local fixture setup script first.');
}

require $project.'/vendor/autoload.php';

// These values win over shell variables and the repository's development .env.
$fixed = [
    'APP_ENV' => 'testing',
    'APP_DEBUG' => 'false',
    'APP_URL' => 'https://127.0.0.1:9443',
    'APP_CONFIG_CACHE' => $runtime.'/bootstrap/cache/config.php',
    'APP_ROUTES_CACHE' => $runtime.'/bootstrap/cache/routes.php',
    'APP_EVENTS_CACHE' => $runtime.'/bootstrap/cache/events.php',
    'APP_SERVICES_CACHE' => $runtime.'/bootstrap/cache/services.php',
    'APP_PACKAGES_CACHE' => $runtime.'/bootstrap/cache/packages.php',
    'DB_CONNECTION' => 'sqlite',
    'DB_URL' => '',
    'DB_DATABASE' => $runtime.'/database.sqlite',
    'CACHE_STORE' => 'database',
    'SESSION_DRIVER' => 'file',
    'QUEUE_CONNECTION' => 'sync',
    'MAIL_MAILER' => 'array',
    'BROADCAST_CONNECTION' => 'reverb',
    'REVERB_APP_ID' => 'native-fixture',
    'REVERB_APP_KEY' => 'native-fixture-key',
    'REVERB_HOST' => '127.0.0.1',
    'REVERB_PORT' => '9018',
    'REVERB_SCHEME' => 'http',
    'REVERB_SERVER_HOST' => '127.0.0.1',
    'REVERB_SERVER_PORT' => '9018',
    'REVERB_SCALING_ENABLED' => 'false',
    'REVERB_ALLOWED_ORIGINS' => '127.0.0.1,localhost',
    'VITE_REVERB_HOST' => '127.0.0.1',
    'VITE_REVERB_PORT' => '9443',
    'VITE_REVERB_SCHEME' => 'https',
    'INERTIA_SSR_ENABLED' => 'false',
    'AUTO_LOGIN_DEV' => 'false',
    'FILESYSTEM_DISK' => 'local',
    'MEDIA_DISK' => 'public',
    'SENTRY_LARAVEL_DSN' => '',
    'SENTRY_DSN' => '',
    'MCP_ENABLED' => 'false',
    'PULSE_ENABLED' => 'false',
    'TELESCOPE_ENABLED' => 'false',
    'BCRYPT_ROUNDS' => '4',
    'GOOGLE_CLIENT_ID' => '',
    'GOOGLE_CLIENT_SECRET' => '',
    'GOOGLE_PLACES_API_KEY' => '',
    'GOOGLE_ANALYTICS_ID' => '',
];
foreach ($fixed as $name => $value) {
    putenv($name.'='.$value);
    $_ENV[$name] = $_SERVER[$name] = $value;
}

$app = require $project.'/bootstrap/app.php';
$app->useEnvironmentPath($runtime);
$app->loadEnvironmentFrom('.env');
$app->useStoragePath($runtime.'/storage');
$app->make(Kernel::class)->bootstrap();

if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== $runtime.'/database.sqlite') {
    throw new RuntimeException('The fixture requires its own SQLite database.');
}

require_once __DIR__.'/spatial-compatibility.php';
nativeFixtureRegisterGeoJson(Illuminate\Support\Facades\DB::connection()->getPdo());
if (! is_string(env('REVERB_APP_SECRET')) || strlen(env('REVERB_APP_SECRET')) < 32) {
    throw new RuntimeException('The local Reverb secret is missing. Run fixture setup.');
}

config([
    'filesystems.disks.public.root' => $runtime.'/storage/app/public',
    'filesystems.disks.public.url' => 'https://127.0.0.1:9443/storage',
    'filesystems.disks.local.root' => $runtime.'/storage/app/private',
    'filesystems.disks.r2' => [
        'driver' => 's3', 'region' => 'us-east-1',
        'url' => 'https://127.0.0.1:9443/fixture-assets', 'visibility' => 'public',
        'throw' => true, 'endpoint' => 'http://127.0.0.1:9019',
        'key' => 'native-fixture', 'secret' => 'local-test-signing-only', 'bucket' => 'native-fixture',
        'use_path_style_endpoint' => true,
    ],
    'services.google_analytics.id' => null,
    'inertia.ssr.enabled' => false,
]);

// Test-only upstream replacement. The real broker, Socialite state, and cache locks still run.
require_once __DIR__.'/LocalGoogleProvider.php';
$google = json_decode(file_get_contents($runtime.'/google-provider.json'), true, flags: JSON_THROW_ON_ERROR);
if (($google['environment'] ?? null) !== 'testing' || ($google['origin'] ?? null) !== 'https://127.0.0.1:9443'
    || ($google['redirectUri'] ?? null) !== 'https://127.0.0.1:9443/auth/google/callback') {
    throw new RuntimeException('The local provider configuration is invalid.');
}
config(['services.google.client_id' => $google['clientId'], 'services.google.client_secret' => $google['clientSecret'], 'services.google.redirect' => $google['redirectUri']]);
Socialite::extend('google', fn ($app) => new LocalGoogleProvider($app['request'], $google['clientId'], $google['clientSecret'], $google['redirectUri']));

// Real domain actions and policies run. All external side effects are blocked.
Http::preventStrayRequests();
Mail::fake();
Notification::fake();
Queue::fake();

// Match Laravel's withoutVite test helper while keeping the real Home root view.
$app->instance(Vite::class, new class extends Vite {
    public function __invoke($entrypoints, $buildDirectory = null)
    {
        return new HtmlString('');
    }

    public function reactRefresh()
    {
        return '';
    }

    public function manifestHash($buildDirectory = null)
    {
        return 'native-local-fixture-v1';
    }
});
Illuminate\Support\Facades\Vite::clearResolvedInstance();

return $app;
