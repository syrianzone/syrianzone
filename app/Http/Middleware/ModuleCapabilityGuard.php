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
 * Every module's admin middleware used to do the same thing: `hasAnyPermission`
 * against the module's whole capability list. That granted the entire module to
 * anyone holding any one capability in it, so a `phonebook.reorder`-only user
 * could DELETE phonebook entries and a `polls.create`-only user could DELETE
 * polls — while the Filament form showed five and three independent checkboxes
 * respectively, implying the access was separated. It was not.
 *
 * The only module that got this right was transit, which passes its capability
 * as a route argument (`transit_admin:transit.approve`) and adds governorate
 * scoping in the controller. This class generalises that, with one deliberate
 * difference.
 *
 * FAILS CLOSED, WHICH TRANSIT DOES NOT
 *
 * TransitAdmin's fallback for a route with no argument is the full capability
 * list — that is how its page shell gets in. Copying that here would mean any
 * route added to a group and left untagged silently inherits the whole module,
 * which is precisely the bug being fixed. So instead: a route with no argument
 * is denied.
 *
 * That has to work around how Laravel composes middleware, and it is not as
 * simple as "no argument means deny". A group applies its alias bare
 * (`phonebook_admin`) while each route adds its own tagged instance
 * (`phonebook_admin:phonebook.edit`). Both resolve to this class and both run,
 * the bare one first. So the bare instance cannot simply deny — it would deny
 * every tagged route too. Instead it looks at the route it is guarding: if the
 * route declares a tag for this alias, the tagged instance is in the pipeline
 * and will enforce, so pass through; if it does not, the route is genuinely
 * untagged and is denied.
 *
 * The cost is that adding a route now requires choosing its capability. That is
 * the point, and `ModuleCapabilityRoutesTest` independently fails the build if a
 * tag is missing or is not a real capability, so this runtime check and that
 * test agree rather than duplicating each other's blind spots.
 *
 * Role implications are NOT re-implemented here. User::hasPermission() already
 * resolves superadmin, the general `admin` role, the per-module admin roles
 * (`phonebook_admin` and friends) and the `*` wildcard, so this class only has
 * to answer the per-route question.
 */
abstract class ModuleCapabilityGuard
{
    /**
     * Route argument meaning "any one capability in this module".
     *
     * For page shells and read-only indexes, where the module membership is
     * itself the authorisation. Never use it on a mutating route.
     */
    public const ANY = 'any';

    /**
     * This module's capability ids.
     *
     * @return array<int, string>
     */
    abstract protected function capabilities(): array;

    /**
     * The route-middleware alias this guard is registered under.
     *
     * Needed so the bare group instance can recognise its own tagged instances.
     * Asserted against bootstrap/app.php by ModuleCapabilityRoutesTest, because a
     * mismatch here is silent: every route would 403.
     */
    abstract public function alias(): string;

    /**
     * Where to send a denied visitor, or null to render a 403.
     *
     * Transit overrides this: its admin page is reached from the main
     * navigation, so an operator without a transit capability is bounced back to
     * the dashboard rather than shown a bare 403 page. That behaviour predates
     * this class and is covered by TransitRedirectTest, so it is preserved
     * rather than normalised away. The other modules have always shown a 403.
     */
    protected function forbiddenRedirect(): ?string
    {
        return null;
    }

    /**
     * Where to send a guest, or null for the standard login page.
     */
    protected function guestRedirect(): ?string
    {
        return null;
    }

    /**
     * @param  string  ...$perms  Capability ids, or the ANY sentinel.
     */
    public function handle(Request $request, Closure $next, string ...$perms): Response
    {
        $user = $request->user();

        if ($user === null) {
            // A guest hitting an admin page should be sent to log in, not told it
            // is forbidden. An XHR to the same route wants a machine-readable
            // answer instead of a redirect to an HTML page.
            if ($this->wantsJson($request)) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $guestRedirect = $this->guestRedirect();

            return $guestRedirect === null
                ? redirect()->guest(route('login'))
                : redirect($guestRedirect);
        }

        $required = $this->resolve($perms);

        if ($required === []) {
            // The bare group instance. If this route carries a tag for us, a
            // tagged instance is queued behind this one and does the real check.
            if ($this->routeIsTagged($request)) {
                return $next($request);
            }

            return $this->forbid($request, sprintf(
                'This route (%s %s) is inside the %s admin group but declares no required capability, '
                .'so it is denied by default. Add a capability or "%s" to the route middleware.',
                $request->method(),
                $request->path(),
                $this->alias(),
                self::ANY
            ));
        }

        if (! $user->hasAnyPermission($required)) {
            return $this->forbid($request, 'Unauthorized.');
        }

        return $next($request);
    }

    /**
     * Whether the current route declares its own capability tag for this alias.
     */
    protected function routeIsTagged(Request $request): bool
    {
        $route = $request->route();

        if ($route === null) {
            return false;
        }

        $prefix = $this->alias().':';

        foreach ($route->gatherMiddleware() as $middleware) {
            if (is_string($middleware) && str_starts_with($middleware, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Turn route arguments into the capability list to check.
     *
     * @param  array<int, string>  $perms
     * @return array<int, string>
     */
    protected function resolve(array $perms): array
    {
        if ($perms === []) {
            return [];
        }

        foreach ($perms as $perm) {
            if ($perm === self::ANY) {
                return $this->capabilities();
            }
        }

        // Unknown ids are kept as-is. hasAnyPermission() denies them, because
        // no user can hold an id that is not in their permission list, so a typo
        // fails closed. ModuleCapabilityRoutesTest is what turns that silent
        // denial into a build failure.
        return array_values(array_unique($perms));
    }

    protected function forbid(Request $request, string $message): Response
    {
        if ($this->wantsJson($request)) {
            return response()->json(['message' => $message], 403);
        }

        $redirect = $this->forbiddenRedirect();

        if ($redirect !== null) {
            return redirect($redirect);
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
     * Guard against a middleware declaring capabilities that are not real, which
     * would make every route using it permanently unreachable.
     */
    public function assertCapabilitiesAreReal(): void
    {
        foreach ($this->capabilities() as $capability) {
            if (! PermissionCatalogue::isKnown($capability)) {
                throw new \LogicException(sprintf(
                    '%s declares unknown capability "%s". Add it to PermissionCatalogue.',
                    static::class,
                    $capability
                ));
            }
        }
    }
}
