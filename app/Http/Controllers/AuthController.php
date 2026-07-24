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
        $redirect = $this->normalizeLocalRedirect($request->query('redirect'));
        if ($redirect !== null) {
            $request->session()->put('url.intended', $redirect);
        }
        // Socialite throws on absent credentials, which turns a misconfigured
        // env into a bare 500 on the login button. Staging runs without a google
        // client on purpose, so answer the same way the callback already does.
        if (! config('services.google.client_id')) {
            return redirect('/?error=auth_unavailable');
        }

        return Socialite::driver('google')->redirect();
    }

    public function handleProviderCallback(GoogleAccountService $accounts)
    {
        try {
            $googleUser = Socialite::driver('google')->user();
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

    private function normalizeLocalRedirect(mixed $redirect): ?string
    {
        if (! is_string($redirect) || $redirect === '' || strlen($redirect) > 2048) {
            return null;
        }

        $candidate = $redirect;
        for ($attempt = 0; $attempt < 8; $attempt++) {
            if (preg_match('/[\\x00-\\x1F\\x7F\\\\]/', $candidate) === 1
                || str_starts_with($candidate, '//')) {
                return null;
            }

            $parts = parse_url($candidate);
            if ($parts === false || array_intersect_key($parts, array_flip([
                'scheme',
                'host',
                'user',
                'pass',
                'port',
            ])) !== []) {
                return null;
            }

            $decoded = rawurldecode($candidate);
            if ($decoded === $candidate) {
                return '/'.ltrim($redirect, '/');
            }

            $candidate = $decoded;
        }

        return null;
    }
}
