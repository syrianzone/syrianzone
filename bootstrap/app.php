<?php

use App\Http\Middleware\Admin;
use App\Http\Middleware\AutoLoginDevUser;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\PhonebookAdmin;
use App\Http\Middleware\SuperAdmin;
use App\Http\Middleware\SyOfficialAdmin;
use App\Http\Middleware\TransitAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Sentry\Laravel\Integration;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: env('API_PREFIX', 'api'),
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');

        $middleware->web(append: [
            AutoLoginDevUser::class,
        ]);

        $middleware->api(prepend: [
            AutoLoginDevUser::class,
        ]);

        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'admin' => Admin::class,
            'transit_admin' => TransitAdmin::class,
            'syofficial_admin' => SyOfficialAdmin::class,
            'phonebook_admin' => PhonebookAdmin::class,
            'superadmin' => SuperAdmin::class,
        ]);
        $middleware->statefulApi();
        $middleware->validateCsrfTokens(except: [
            // Guest submissions only. The authenticated PUT /api/v1/studio/routes/{id}
            // must keep CSRF protection, so never widen this to studio/routes/*.
            // Native clients send bearer tokens and are not stateful, so they are unaffected.
            'api/v1/studio/routes',
            'api/submit',
            'guesswho/broadcasting/auth',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        Integration::handles($exceptions);
    })->create();
