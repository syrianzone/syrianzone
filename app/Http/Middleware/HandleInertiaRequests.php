<?php

namespace App\Http\Middleware;

use App\Models\SiteSetting;
use App\Models\User;
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
     * The auth payload shared with every Inertia response.
     *
     * `effective_permissions` is the resolved list — role implications already
     * applied by User::effectivePermissions(). The frontend uses it as the
     * single source of truth for capability checks instead of re-deriving which
     * modules a role implies, which is how the TS mirror drifted out of sync
     * with the PHP rules. `permissions` is still sent for the admin UI, which
     * needs the raw stored values to render its checkboxes.
     *
     * @return array<string, mixed>
     */
    public static function userPayload(?User $user): ?array
    {
        if ($user === null) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'avatar_url' => $user->avatar_url,
            'permissions' => $user->permissions ?? [],
            'effective_permissions' => $user->effectivePermissions(),
            'permission_scopes' => $user->permission_scopes ?? [],
            'settings' => $user->settings ?? null,
        ];
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
        $devMode = AutoLoginDevUser::isDevMode();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => self::userPayload($request->user()),
            ],
            'dev' => [
                'enabled' => $devMode,
                'roles' => $devMode ? AutoLoginDevUser::DEV_ROLES : [],
                'currentRole' => $devMode && $request->user()
                    ? $request->user()->role
                    : null,
            ],
            'sitePopup' => SiteSetting::getPopup(),
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
