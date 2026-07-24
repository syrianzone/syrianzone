<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AutoLoginDevUser
{
    public const DEV_ROLES = ['user', 'transit_admin', 'admin', 'superadmin'];

    public const DEV_USERS = [
        'user' => ['name' => 'Dev User',          'email' => 'dev-user@syrian.zone'],
        'transit_admin' => ['name' => 'Dev Transit Admin', 'email' => 'dev-transit@syrian.zone'],
        'admin' => ['name' => 'Dev Admin',         'email' => 'dev-admin@syrian.zone'],
        'superadmin' => ['name' => 'Dev Superadmin',    'email' => 'dev-superadmin@syrian.zone'],
    ];

    public static function isDevMode(): bool
    {
        return config('app.env') !== 'production' && env('AUTO_LOGIN_DEV', false) === true;
    }

    public function handle(Request $request, Closure $next)
    {
        if (! self::isDevMode()) {
            return $next($request);
        }

        // The impersonation route sets the dev_role cookie itself; let it run.
        if ($request->route()?->named('dev.impersonate')) {
            return $next($request);
        }

        $role = $this->resolveRole($request);
        $user = $this->ensureDevUser($role);

        // Always enforce the chosen dev role as the active identity.
        // The role is stored in the session (set by DevController) with a
        // cookie fallback so a browser keeps the choice across restarts.
        if (! Auth::check() || Auth::user()->role !== $role || Auth::user()->email !== $user->email) {
            Auth::login($user, true);
        }

        return $next($request);
    }

    public function resolveRole(Request $request): string
    {
        // Prefer the session choice (set by DevController); fall back to the
        // dev_role cookie. Both are written together on impersonation.
        $role = null;
        try {
            if ($request->hasSession() && $request->session()->isStarted()) {
                $role = $request->session()->get('dev_role');
            }
        } catch (\Throwable $e) {
            $role = null;
        }
        if (! $role) {
            $role = $request->cookie('dev_role');
        }

        return in_array($role, self::DEV_ROLES) ? $role : 'superadmin';
    }

    public function ensureDevUser(string $role): User
    {
        $role = in_array($role, self::DEV_ROLES) ? $role : 'superadmin';
        $spec = self::DEV_USERS[$role];

        return User::firstOrCreate(
            ['email' => $spec['email']],
            [
                'name' => $spec['name'],
                'google_id' => 'dev-'.$role,
                'avatar_url' => 'https://github.com/identicons/'.$role.'.png',
                'password' => bcrypt('password'),
                'role' => $role,
            ]
        );
    }
}
