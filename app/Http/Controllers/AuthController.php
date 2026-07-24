<?php

namespace App\Http\Controllers;

use App\Services\GoogleAccountService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class AuthController extends Controller
{
    public function redirectToProvider(Request $request)
    {
        $redirect = $request->query('redirect');
        if ($redirect && filter_var($redirect, FILTER_VALIDATE_URL) === false) {
            $request->session()->put('url.intended', '/'.ltrim($redirect, '/'));
        }

        return Socialite::driver('google')->redirect();
    }

    public function handleProviderCallback(GoogleAccountService $accounts)
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (Throwable) {
            return redirect('/?error=auth_failed');
        }

        $user = $accounts->resolve($googleUser);
        if (! $user) {
            return redirect('/?error=access_denied');
        }

        Auth::login($user, true);

        return redirect()->intended('/dashboard');
    }

    public function user(Request $request)
    {
        return $request->user();
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out']);
    }
}
