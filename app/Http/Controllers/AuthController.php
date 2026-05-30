<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    private const SUPERADMIN_EMAIL = 'hade.alahmad1@gmail.com';

    public function redirectToProvider()
    {
        return Socialite::driver('google')->redirect();
    }

    public function handleProviderCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Exception $e) {
            return redirect(env('FRONTEND_URL') . '/login?error=auth_failed');
        }

        $email = $googleUser->getEmail();
        $user = User::where('email', $email)->first();
        $isSuperAdmin = $email === self::SUPERADMIN_EMAIL;

        if (!$user && !$isSuperAdmin) {
            return redirect(env('FRONTEND_URL') . '/letmein?error=access_denied_admin_only');
        }

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $googleUser->getName(),
                'google_id' => $googleUser->getId(),
                'avatar_url' => $googleUser->getAvatar(),
                'password' => $user?->password ?? bcrypt(str()->random(16)),
                'role' => $isSuperAdmin ? 'superadmin' : ($user?->role ?? 'admin'),
            ]
        );

        Auth::login($user, true);
        return redirect(env('FRONTEND_URL') . '/admin/polls');
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
