<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

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
            \App\Http\Middleware\AutoLoginDevUser::class,
        ]);
        
        $middleware->api(prepend: [
            \App\Http\Middleware\AutoLoginDevUser::class,
        ]);
        
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'admin'           => \App\Http\Middleware\Admin::class,
            'transit_admin'   => \App\Http\Middleware\TransitAdmin::class,
            'syofficial_admin' => \App\Http\Middleware\SyOfficialAdmin::class,
            'phonebook_admin'  => \App\Http\Middleware\PhonebookAdmin::class,
            'superadmin'      => \App\Http\Middleware\SuperAdmin::class,
        ]);
        $middleware->statefulApi();
        $middleware->validateCsrfTokens(except: [
            // Guest submissions only. The authenticated PUT /api/v1/studio/routes/{id}
            // must keep CSRF protection — do not widen this to studio/routes/*.
            'api/v1/studio/routes',
            'api/submit',
            'guesswho/broadcasting/auth',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        \Sentry\Laravel\Integration::handles($exceptions);
    })->create();
