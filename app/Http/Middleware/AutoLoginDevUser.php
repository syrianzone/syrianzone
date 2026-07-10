<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

class AutoLoginDevUser
{
    public function handle(Request $request, Closure $next)
    {
        if (config('app.env') !== 'production' && env('AUTO_LOGIN_DEV', false) === true) {
            if (!Auth::check()) {
                $user = User::where('role', 'superadmin')->orWhere('role', 'admin')->first();
                
                if (!$user) {
                    $user = User::create([
                        'name' => 'Development Admin',
                        'email' => 'admin@syrian.zone',
                        'google_id' => 'dev-admin-id',
                        'avatar_url' => 'https://github.com/identicons/dev-admin.png',
                        'password' => bcrypt('password'),
                        'role' => 'superadmin',
                    ]);
                }
                
                Auth::login($user, true);
            }
        }

        return $next($request);
    }
}
