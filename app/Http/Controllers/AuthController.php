<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{

    public function redirectToProvider(Request $request)
    {
        $redirect = $request->query('redirect');
        if ($redirect && filter_var($redirect, FILTER_VALIDATE_URL) === false) {
            $request->session()->put('url.intended', '/' . ltrim($redirect, '/'));
        }
        return Socialite::driver('google')->redirect();
    }

    public function handleProviderCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Exception $e) {
            return redirect('/?error=auth_failed');
        }

        $email = $googleUser->getEmail();
        // withTrashed: a soft-deleted account still holds the unique email, so a
        // scoped miss would send updateOrCreate into a duplicate-email insert (500).
        $user = User::withTrashed()->where('email', $email)->first();
        if ($user && $user->trashed()) {
            $user->restore();
        }
        $superadminEmail = config('app.superadmin_email');
        $isSuperAdmin = $superadminEmail !== '' && $email === $superadminEmail;

        // Self-registration: unknown emails become regular users so the
        // community can contribute (places, comments). Existing users keep their role.
        $attributes = [
            'name' => $googleUser->getName(),
            'google_id' => $googleUser->getId(),
            'password' => $user?->password ?? bcrypt(str()->random(16)),
            'role' => $isSuperAdmin ? 'superadmin' : ($user?->role ?? 'user'),
        ];
        // Refresh the Google avatar only when the user has not uploaded a custom
        // one; a custom avatar lives under our media disk's avatars/ prefix.
        if (!$this->hasCustomAvatar($user)) {
            $attributes['avatar_url'] = $googleUser->getAvatar();
        }
        $user = User::updateOrCreate(['email' => $email], $attributes);

        Auth::login($user, true);
        return redirect()->intended('/dashboard');
    }

    private function hasCustomAvatar(?User $user): bool
    {
        if (!$user || $user->avatar_url === null) {
            return false;
        }
        // Structural match on the url path (/avatars/{id}/ under any base): a
        // MEDIA_DISK switch changes the base url, and a prefix check against the
        // current disk would let the Google avatar clobber pre-switch uploads.
        $path = parse_url($user->avatar_url, PHP_URL_PATH) ?? '';
        return is_string($path) && str_contains($path, "/avatars/{$user->id}/");
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
