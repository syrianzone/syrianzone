<?php

namespace App\Http\Controllers;

use App\Http\Middleware\AutoLoginDevUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DevController extends Controller
{
    public function impersonate(Request $request, string $role)
    {
        if (! AutoLoginDevUser::isDevMode()) {
            abort(404);
        }

        if (! in_array($role, AutoLoginDevUser::DEV_ROLES)) {
            abort(400, 'Unknown dev role: '.$role);
        }

        $user = (new AutoLoginDevUser)->ensureDevUser($role);

        Auth::logout();
        Auth::login($user, true);

        session(['dev_role' => $role]);

        return redirect('/')->withCookie(cookie('dev_role', $role, 60 * 24 * 30));
    }
}
