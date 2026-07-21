<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $devMode = \App\Http\Middleware\AutoLoginDevUser::isDevMode();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'role' => $request->user()->role,
                    'avatar_url' => $request->user()->avatar_url,
                    'permissions' => $request->user()->permissions ?? [],
                ] : null,
            ],
            'dev' => [
                'enabled' => $devMode,
                'roles' => $devMode ? \App\Http\Middleware\AutoLoginDevUser::DEV_ROLES : [],
                'currentRole' => $devMode && $request->user()
                    ? $request->user()->role
                    : null,
            ],
        ];
    }

    /**
     * Handle the incoming request and prevent caching of Inertia responses to avoid back-button JSON issues.
     *
     * `no-store` is used (not `no-cache`) because it is the only Cache-Control directive
     * that instructs the browser NOT to store the response in the Back/Forward Cache (bfcache).
     * Without this, navigating back can surface the raw Inertia JSON payload.
     * We only apply these headers to Inertia XHR requests so full-page responses are unaffected.
     */
    public function handle(Request $request, \Closure $next)
    {
        $response = parent::handle($request, $next);

        if ($request->header('X-Inertia')) {
            $response->headers->set('Cache-Control', 'no-store, private');
            $response->headers->set('Vary', 'X-Inertia');
        }

        return $response;
    }
}
