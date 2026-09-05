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
        // Trust private-network proxies (Docker gateway, Nginx sidecar,
        // localhost) so $request->ip() reflects X-Forwarded-For from our own
        // edge. Trusting '*' would let any client spoof X-Forwarded-For and
        // bypass IP-keyed throttles (voting, public-api) and ip_hash fraud
        // signals, so public ranges are deliberately not trusted.
        $middleware->trustProxies(at: ['127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);
        
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
            'places_admin'    => \App\Http\Middleware\PlacesAdmin::class,
            'polls_admin'     => \App\Http\Middleware\PollsAdmin::class,
            'superadmin'      => \App\Http\Middleware\SuperAdmin::class,
        ]);
        $middleware->statefulApi();
        $middleware->validateCsrfTokens(except: [
            // Guest submissions only. The authenticated PUT /api/v1/studio/routes/{id}
            // must keep CSRF protection — do not widen this to studio/routes/*.
            // Note: /api/* routes are stateless (no session CSRF) — these entries
            // cover same-path web-group hits. Guest vote fraud is mitigated by
            // throttle:voting (10/min/IP) + the ballots (poll_id, vote_day,
            // voter_key) unique index, not by CSRF. Do not add CAPTCHA here
            // without a UX review — it would block legitimate guest voting.
            'api/v1/studio/routes',
            'api/submit',
            'guesswho/broadcasting/auth',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        \Sentry\Laravel\Integration::handles($exceptions);
    })->create();
