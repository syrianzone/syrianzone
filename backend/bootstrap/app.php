<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias(['transit.admin' => \App\Http\Middleware\TransitAdminAuth::class]);
        $middleware->statefulApi();
        $middleware->validateCsrfTokens(except: [
            'api/v1/studio/routes',
            'api/v1/admin/login',
            'api/v1/admin/route-drafts',
            'api/v1/admin/route-drafts/*',
            'api/polls/*/vote',
            'api/submit',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
