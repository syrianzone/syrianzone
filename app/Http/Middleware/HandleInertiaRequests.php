<?php

namespace App\Http\Middleware;

use App\Models\SiteSetting;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Inertia\Inertia;
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
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $devMode = AutoLoginDevUser::isDevMode();

        $site = SiteSetting::shared();
        // Once-prop keys are a hash of the content itself, not the stored
        // `version` alone: the navigation is merged with the
        // `resources/data/site-modules.json` defaults, so a deploy that adds a
        // module changes it without an admin edit bumping the version.
        $navKey = self::contentKey($site['navigation']);
        $popupKey = self::contentKey($site['popup']);

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user()?->toAuthPayload(),
            ],
            'dev' => [
                'enabled' => $devMode,
                'roles' => $devMode ? AutoLoginDevUser::presets() : [],
                'currentRole' => $devMode
                    ? (new AutoLoginDevUser)->resolveRole($request)
                    : null,
            ],
            'sitePopup' => Inertia::once(fn () => $site['popup'])->as("sitePopup:{$popupKey}"),
            // The site-module catalogue merged with the admin's stored override
            // row: `resources/data/site-modules.json` is the default, so the
            // browser never falls back to a second, hand-written list. Sent once:
            // Inertia omits it on later visits until its content key changes.
            'siteNavigation' => Inertia::once(fn () => $site['navigation'])->as("siteNavigation:{$navKey}"),
            // One resolved SEO object per request, rendered by the single
            // <SeoHead> component. The root view renders the same values
            // server-side when SSR is off. See docs/guidelines/seo.md.
            // Lazy, so it runs after the controller: a page that already loaded its
            // record (SeoMeta::remember) is not queried for it a second time, and
            // JSON responses on the web stack never resolve it at all.
            'seo' => fn () => SeoMeta::resolve($request),
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
    /**
     * A short, stable key for a once-prop's content.
     */
    private static function contentKey(mixed $value): string
    {
        return substr(hash('xxh128', json_encode($value) ?: ''), 0, 12);
    }

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
