<?php

namespace App\Http\Middleware;

use App\Support\Permissions\PermissionCatalogue;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces a single module capability per admin route.
 *
 * WHY THIS EXISTS
 *
 * A group-level `hasAnyPermission` against a module's whole capability list
 * grants the entire module to anyone holding any one capability in it, so a
 * `phonebook.reorder`-only user could DELETE phonebook entries and a
 * `polls.create`-only user could DELETE polls — while the Filament form showed
 * five and three independent checkboxes respectively, implying the access was
 * separated. It was not.
 *
 * Transit gets this right by passing its capability as a route argument
 * (`transit_admin:transit.approve`) and adding governorate scoping in the
 * controller. This class generalises that, with one deliberate difference.
 *
 * ONE CLASS, MANY ALIASES
 *
 * The alias name and the module's capability ids both belong to the catalogue
 * and the alias table below, so they are data: every alias in ALIASES points at
 * this class, and the module is read from the alias or from the capability id
 * in the route tag. Adding a module is a catalogue entry plus one alias line,
 * not a new middleware.
 *
 * FAILS CLOSED, WHICH TRANSIT DOES NOT
 *
 * There is no group-level fallback to the whole module: a route with no
 * argument is denied. A group applies its alias bare (`phonebook_admin`) while
 * each route adds its own tagged instance (`phonebook_admin:phonebook.edit`).
 * Both resolve to this class and both run, the bare one first. It cannot simply
 * deny either — it would deny every tagged route too. Instead it looks at the
 * route it is guarding: if the route declares a tag for a guarded alias, the
 * tagged instance is in the pipeline and will enforce, so it passes through; if
 * it does not, the route is genuinely untagged and is denied.
 *
 * The cost is that adding a route now requires choosing its capability. That is
 * the point, and `ModuleCapabilityRoutesTest` independently fails the build if a
 * tag is missing or is not a real capability, so this runtime check and that
 * test agree rather than duplicating each other's blind spots.
 *
 * Role implications are NOT re-implemented here. User::hasPermission() already
 * resolves superadmin and the `*` wildcard, so this class only has to answer
 * the per-route question.
 */
final class ModuleCapabilityGuard
{
    /**
     * Route argument meaning "any one capability in this module".
     *
     * For page shells and read-only indexes, where the module membership is
     * itself the authorisation. Never use it on a mutating route.
     */
    public const ANY = 'any';

    /**
     * Route-middleware alias => catalogue module guarded by that alias.
     *
     * The alias name is the public contract: routes use it and
     * ModuleCapabilityRoutesTest reads it. It is asserted against
     * bootstrap/app.php, because a mismatch here is silent: every route would
     * 403.
     *
     * @var array<string, string>
     */
    public const ALIASES = [
        'transit_admin' => 'transit',
        'syofficial_admin' => 'syofficial',
        'phonebook_admin' => 'phonebook',
        'places_admin' => 'places',
        'polls_admin' => 'polls',
        'compass_admin' => 'compass',
        'promises_admin' => 'promises',
        'govapps_admin' => 'govapps',
        'users_admin' => 'users',
        'guesswho_admin' => 'guesswho',
        'assets_admin' => 'assets',
        'site_admin' => 'site',
    ];

    /**
     * @param  string  ...$perms  Capability ids, or the ANY sentinel.
     */
    public function handle(Request $request, Closure $next, string ...$perms): Response
    {
        $user = $request->user();
        $module = $this->module($request, $perms);

        if ($user === null) {
            // A guest hitting an admin page should be sent to log in, not told it
            // is forbidden. An XHR to the same route wants a machine-readable
            // answer instead of a redirect to an HTML page.
            if ($this->wantsJson($request)) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            return $module === 'transit'
                ? redirect('/dashboard')
                : redirect()->guest(route('login'));
        }

        $required = $this->resolve($perms, $module);

        if ($required === []) {
            // The bare group instance. If this route carries a tag for a guarded
            // alias, a tagged instance is queued behind this one and does the
            // real check.
            if ($this->routeIsTagged($request)) {
                return $next($request);
            }

            return $this->forbid($request, $module, sprintf(
                'This route (%s %s) is inside the %s admin group but declares no required capability, '
                .'so it is denied by default. Add a capability or "%s" to the route middleware.',
                $request->method(),
                $request->path(),
                $this->alias($request) ?? implode('|', array_keys(self::ALIASES)),
                self::ANY
            ));
        }

        if (! $user->hasAnyPermission($required)) {
            return $this->forbid($request, $module, 'Unauthorized.');
        }

        return $next($request);
    }

    /**
     * Which catalogue module this route is being guarded for.
     *
     * Taken from the capability tag when there is one, otherwise from the bare
     * group alias, so a route inside `transit_admin` is recognised as transit
     * even on the untagged group instance.
     *
     * @param  array<int, string>  $perms
     */
    private function module(Request $request, array $perms): ?string
    {
        foreach ($perms as $permission) {
            if ($permission !== self::ANY && str_contains($permission, '.')) {
                return explode('.', $permission, 2)[0];
            }
        }

        foreach ($this->guardedMiddleware($request) as [$alias, $argument]) {
            if ($argument !== null && $argument !== self::ANY && str_contains($argument, '.')) {
                return explode('.', $argument, 2)[0];
            }

            return self::ALIASES[$alias];
        }

        return null;
    }

    /**
     * Every guarded alias on the route, as [alias, tag argument or null].
     *
     * @return array<int, array{0: string, 1: string|null}>
     */
    private function guardedMiddleware(Request $request): array
    {
        $found = [];

        foreach ($request->route()?->gatherMiddleware() ?? [] as $middleware) {
            if (! is_string($middleware)) {
                continue;
            }

            [$name, $argument] = array_pad(explode(':', $middleware, 2), 2, null);

            if (isset(self::ALIASES[$name])) {
                $found[] = [$name, $argument];
            }
        }

        return $found;
    }

    /**
     * Whether the current route declares its own capability tag for a guard.
     */
    protected function routeIsTagged(Request $request): bool
    {
        foreach ($this->guardedMiddleware($request) as [$alias, $argument]) {
            if ($argument !== null) {
                return true;
            }
        }

        return false;
    }

    /**
     * The bare alias this route is inside, for error messages.
     */
    private function alias(Request $request): ?string
    {
        foreach ($this->guardedMiddleware($request) as [$alias, $argument]) {
            if ($argument === null) {
                return $alias;
            }
        }

        return null;
    }

    /**
     * Turn route arguments into the capability list to check.
     *
     * @param  array<int, string>  $perms
     * @return array<int, string>
     */
    protected function resolve(array $perms, ?string $module): array
    {
        if ($perms === []) {
            return [];
        }

        foreach ($perms as $perm) {
            if ($perm === self::ANY) {
                return $module === null ? [] : PermissionCatalogue::forModule($module);
            }
        }

        // Unknown ids are kept as-is. hasAnyPermission() denies them, because
        // no user can hold an id that is not in their permission list, so a typo
        // fails closed. ModuleCapabilityRoutesTest is what turns that silent
        // denial into a build failure.
        return array_values(array_unique($perms));
    }

    protected function forbid(Request $request, ?string $module, string $message): Response
    {
        if ($this->wantsJson($request)) {
            return response()->json(['message' => $message], 403);
        }

        // The transit page is one click from the main navigation, so a user who
        // cannot moderate lands somewhere useful instead of on an error page.
        // That behaviour predates this class (TransitRedirectTest pins it); the
        // other module groups have always shown a 403.
        if ($module === 'transit') {
            return redirect('/dashboard');
        }

        abort(403, $message);
    }

    /**
     * Whether this caller should get a JSON error rather than an HTML 403.
     */
    protected function wantsJson(Request $request): bool
    {
        return $request->expectsJson() || $request->is('api/*');
    }

    /**
     * Guard against a middleware alias or catalogue group pointing at something
     * that does not exist, which would make every route using it unreachable.
     */
    public function assertCapabilitiesAreReal(): void
    {
        $groups = PermissionCatalogue::groups();

        foreach (self::ALIASES as $alias => $module) {
            if (! isset($groups[$module])) {
                throw new \LogicException(sprintf(
                    'Middleware alias "%s" guards unknown module "%s". Add it to PermissionCatalogue.',
                    $alias,
                    $module
                ));
            }
        }

        foreach (array_keys($groups) as $module) {
            if (! in_array($module, self::ALIASES, true)) {
                throw new \LogicException(sprintf(
                    'PermissionCatalogue module "%s" has no admin middleware alias, so its routes cannot be guarded.',
                    $module
                ));
            }
        }
    }
}
