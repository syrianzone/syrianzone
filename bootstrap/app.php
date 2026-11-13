<?php

use App\Exceptions\DomainActionException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

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
        
        // Order is significant: SecurityHeaders generates the CSP nonce that
        // the Inertia root view stamps onto its script tags, so it has to run
        // before HandleInertiaRequests renders the response.
        $middleware->web(append: [
            \App\Http\Middleware\AutoLoginDevUser::class,
            \App\Http\Middleware\SecurityHeaders::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);

        $middleware->api(prepend: [
            \App\Http\Middleware\AutoLoginDevUser::class,
        ]);

        // Ensure AutoLoginDevUser runs after StartSession and before Authenticate
        // on auth-guarded web and API routes.
        $middleware->prependToPriorityList(
            \Illuminate\Auth\Middleware\Authenticate::class,
            \App\Http\Middleware\AutoLoginDevUser::class
        );

        // Every module guard alias resolves to the one parameterised guard; the
        // module comes from the alias table on the class and the capability from
        // the route tag. ModuleCapabilityRoutesTest asserts these names.
        $middleware->alias([
            'transit_admin'   => \App\Http\Middleware\ModuleCapabilityGuard::class,
            'syofficial_admin' => \App\Http\Middleware\ModuleCapabilityGuard::class,
            'phonebook_admin'  => \App\Http\Middleware\ModuleCapabilityGuard::class,
            'places_admin'    => \App\Http\Middleware\ModuleCapabilityGuard::class,
            'polls_admin'     => \App\Http\Middleware\ModuleCapabilityGuard::class,
            // Compass admin: read-only anonymous statistics for the compass test.
            'compass_admin'   => \App\Http\Middleware\ModuleCapabilityGuard::class,
            // Promises tracker: promises, review queue, speakers and sectors.
            'promises_admin'  => \App\Http\Middleware\ModuleCapabilityGuard::class,
            // Gov Apps admin group. ModuleCapabilityGuard needs the alias so a
            // per-route capability can be passed through.
            'govapps_admin'   => \App\Http\Middleware\ModuleCapabilityGuard::class,
            // General user moderation (banning). Not a content module: this is
            // application-wide, so it is authorised by its own capability.
            'users_admin'     => \App\Http\Middleware\ModuleCapabilityGuard::class,
            // Superadmin-only modules: the game content, the hosted-file manager
            // and the site-wide settings surfaces.
            'guesswho_admin'  => \App\Http\Middleware\ModuleCapabilityGuard::class,
            'assets_admin'    => \App\Http\Middleware\ModuleCapabilityGuard::class,
            'site_admin'      => \App\Http\Middleware\ModuleCapabilityGuard::class,
            'superadmin'      => \App\Http\Middleware\SuperAdmin::class,
            // Agent API tokens: any capability holder, for their own tokens.
            'agent_tokens'    => \App\Http\Middleware\AgentTokensAccess::class,
        ]);
        $middleware->statefulApi();
        $middleware->validateCsrfTokens(except: [
            // Guest submissions and stateless mobile token exchange.
            // Note: /api/* routes are stateless (no session CSRF) — these entries
            // cover same-path web-group hits. Guest vote fraud is mitigated by
            // throttle:voting (10/min/IP) + the ballots (poll_id, vote_day,
            // voter_key) unique index, not by CSRF. Do not add CAPTCHA here
            // without a UX review — it would block legitimate guest voting.
            'api/v1/transit/studio/routes',
            'api/v1/studio/routes',
            'api/v1/auth/google/token',
            'api/v1/auth/google',
            'api/submit',
            'guesswho/broadcasting/auth',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        \Sentry\Laravel\Integration::handles($exceptions);

        $exceptions->dontReport([
            DomainActionException::class,
        ]);

        $exceptions->render(function (DomainActionException $e, Request $request) {
            if ($e->httpStatus() === 404 && ! $request->expectsJson()) {
                throw new NotFoundHttpException($e->getMessage(), $e);
            }

            return response()->json([
                'message' => $e->getMessage(),
            ], $e->httpStatus());
        });

        $exceptions->respond(function (Response $response, \Throwable $exception, Request $request) {
            if (
                $response instanceof JsonResponse
                && $response->getStatusCode() >= 400
            ) {
                $data = $response->getData(true);
                if (
                    is_array($data)
                    && ! isset($data['message'])
                    && isset($data['error'])
                    && is_string($data['error'])
                ) {
                    $response->setData(['message' => $data['error']] + $data);
                }
            }

            if (
                $response->getStatusCode() === 404
                && $request->isMethod('GET')
                && ! $request->expectsJson()
                && ! $request->is('api/*', 'superadmin*')
            ) {
                \App\Support\Seo\SeoMeta::override($request, [
                    'title' => 'الصفحة غير موجودة (404) | Syrian Zone',
                    'description' => 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها — استكشف أدوات ومشاريع المساحة السورية.',
                    'robots' => 'noindex, follow',
                ]);

                Inertia::share(app(\App\Http\Middleware\HandleInertiaRequests::class)->share($request));

                // This page is rendered outside the middleware stack, so the
                // nonce has to be registered before the view stamps its script
                // tags, then the headers are applied to the finished response.
                $securityHeaders = app(\App\Http\Middleware\SecurityHeaders::class);
                $securityHeaders->registerNonce();

                $section = match (true) {
                    $request->is('muslim', 'muslim/*') => 'muslim',
                    $request->is('games', 'games/*', 'guesswho', 'guesswho/*') => 'games',
                    $request->is('transit', 'transit/*', 'mishwar', 'mishwar/*', 'crossings', 'crossings/*', 'places', 'places/*') => 'transit',
                    default => 'general',
                };

                $override = $request->query('section');
                if (in_array($override, ['general', 'transit', 'games', 'muslim'], true)) {
                    $section = $override;
                }

                return $securityHeaders->applyHeaders(Inertia::render('Errors/NotFound', [
                    'status' => 404,
                    'path' => '/'.ltrim($request->path(), '/'),
                    'section' => $section,
                ])->toResponse($request)->setStatusCode(404)->prepare($request));
            }

            return $response;
        });
    })->create();
