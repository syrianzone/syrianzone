<?php

namespace App\Http\Controllers;

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    public function redirectToProvider(Request $request)
    {
        if ($request->has('redirect')) {
            $redirect = $request->query('redirect');
            // Reject scheme-relative URLs (//evil.com) and non-path values to prevent open-redirect
            if (is_string($redirect) && str_starts_with($redirect, '/') && ! str_starts_with($redirect, '//')) {
                session(['url.intended' => $redirect]);
            }
        }

        return Socialite::driver('google')->redirect();
    }

    public function handleProviderCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (\Exception $e) {
            return redirect('/?error=auth_failed');
        }

        $email = $googleUser->getEmail();
        if (! is_string($email) || $email === '') {
            return redirect('/?error=auth_failed');
        }

        $user = $this->upsertAndResolveGoogleUser(
            email: $email,
            googleId: $googleUser->getId(),
            name: $googleUser->getName(),
            avatar: $googleUser->getAvatar(),
        );

        // Banned accounts must not be able to (re)login via Google; their
        // existing sessions are handled by middleware, this gates new logins.
        if ($user->is_banned) {
            return redirect('/?error=banned');
        }

        Auth::login($user, true);

        return redirect()->intended('/dashboard');
    }

    /**
     * Stateless Google OAuth token exchange for Flutter / mobile clients.
     *
     * Accepts either a Google `id_token` (verified against Google's tokeninfo
     * endpoint + audience check) OR a Google `access_token` (verified against
     * Google's userinfo endpoint + optional audience check), and resolves the
     * user against the exact same `users` table / account pool as the web app.
     */
    public function googleToken(Request $request)
    {
        $validated = $request->validate([
            'id_token' => 'nullable|string|required_without:access_token',
            'access_token' => 'nullable|string|required_without:id_token',
            'device_name' => 'nullable|string|max:255',
        ]);

        $email = null;
        $googleId = null;
        $name = null;
        $avatar = null;
        $allowedClientIds = config('services.google.allowed_client_ids', []);

        if (! empty($validated['id_token'])) {
            try {
                $response = Http::timeout(8)->get('https://oauth2.googleapis.com/tokeninfo', [
                    'id_token' => $validated['id_token'],
                ]);
            } catch (\Throwable $e) {
                return response()->json(['message' => 'Unable to verify Google token at this time.'], 503);
            }

            if (! $response->successful()) {
                return response()->json(['message' => 'Invalid or expired Google id_token.'], 401);
            }

            $payload = $response->json();
            $emailVerified = ($payload['email_verified'] ?? false) === true
                || ($payload['email_verified'] ?? '') === 'true';

            if (! is_array($payload) || empty($payload['email']) || ! $emailVerified) {
                return response()->json(['message' => 'Google token does not contain a verified email.'], 401);
            }

            $aud = (string) ($payload['aud'] ?? '');
            if (! empty($allowedClientIds) && ! in_array($aud, $allowedClientIds, true)) {
                return response()->json(['message' => 'Invalid Google token audience.'], 401);
            }

            $email = (string) $payload['email'];
            $googleId = isset($payload['sub']) ? (string) $payload['sub'] : null;
            $name = isset($payload['name']) && trim((string) $payload['name']) !== ''
                ? (string) $payload['name']
                : explode('@', $email)[0];
            $avatar = isset($payload['picture']) ? (string) $payload['picture'] : null;
        } else {
            try {
                $userInfoResponse = Http::timeout(8)
                    ->withToken($validated['access_token'])
                    ->get('https://www.googleapis.com/oauth2/v3/userinfo');
            } catch (\Throwable $e) {
                return response()->json(['message' => 'Unable to verify Google access_token at this time.'], 503);
            }

            if (! $userInfoResponse->successful()) {
                return response()->json(['message' => 'Invalid or expired Google access_token.'], 401);
            }

            $payload = $userInfoResponse->json();
            $emailVerified = ($payload['email_verified'] ?? false) === true
                || ($payload['email_verified'] ?? '') === 'true';

            if (! is_array($payload) || empty($payload['email']) || ! $emailVerified) {
                return response()->json(['message' => 'Google account does not contain a verified email.'], 401);
            }

            if (! empty($allowedClientIds)) {
                try {
                    $tokenInfoResponse = Http::timeout(8)->get('https://oauth2.googleapis.com/tokeninfo', [
                        'access_token' => $validated['access_token'],
                    ]);
                    if ($tokenInfoResponse->successful()) {
                        $tokenInfo = $tokenInfoResponse->json();
                        $aud = (string) ($tokenInfo['aud'] ?? $tokenInfo['azp'] ?? '');
                        if ($aud !== '' && ! in_array($aud, $allowedClientIds, true)) {
                            return response()->json(['message' => 'Invalid Google token audience.'], 401);
                        }
                    }
                } catch (\Throwable $e) {
                    // Continue if optional tokeninfo check is unreachable after userinfo succeeded
                }
            }

            $email = (string) $payload['email'];
            $googleId = isset($payload['sub']) ? (string) $payload['sub'] : null;
            $name = isset($payload['name']) && trim((string) $payload['name']) !== ''
                ? (string) $payload['name']
                : explode('@', $email)[0];
            $avatar = isset($payload['picture']) ? (string) $payload['picture'] : null;
        }

        $user = $this->upsertAndResolveGoogleUser($email, $googleId, $name, $avatar);

        if ($user->is_banned) {
            return response()->json(['message' => 'Your account has been banned.'], 403);
        }

        $deviceName = trim((string) ($validated['device_name'] ?? 'mobile')) ?: 'mobile';
        $newAccessToken = $user->createToken($deviceName, ['mobile']);

        return response()->json([
            'token' => $newAccessToken->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $newAccessToken->accessToken->expires_at?->toIso8601String(),
            'user' => HandleInertiaRequests::userPayload($user),
        ]);
    }

    /**
     * Shared cross-platform user lookup/upsert by email so Web and Flutter
     * share a single account pool, role grants, custom avatar, and drafts.
     */
    private function upsertAndResolveGoogleUser(
        string $email,
        ?string $googleId,
        ?string $name,
        ?string $avatar,
    ): User {
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
            'google_id' => $googleId ?? $user?->google_id,
            'password' => $user?->password ?? bcrypt(str()->random(16)),
            'role' => $isSuperAdmin ? 'superadmin' : ($user?->role ?? 'user'),
        ];
        // Google only seeds the display name at signup. Overwriting it on every login
        // undid any name set in the dashboard and put real names on public pages.
        if (! $user) {
            $attributes['name'] = $name ?: explode('@', $email)[0];
        }
        // Refresh the Google avatar only when the user has not uploaded a custom
        // one; a custom avatar lives under our media disk's avatars/ prefix.
        if (! $this->hasCustomAvatar($user) && $avatar !== null) {
            $attributes['avatar_url'] = $avatar;
        }

        return User::updateOrCreate(['email' => $email], $attributes);
    }

    private function hasCustomAvatar(?User $user): bool
    {
        if (! $user || $user->avatar_url === null) {
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
        $user = $request->user() ?? Auth::guard('sanctum')->user();

        if ($user && $user->is_banned) {
            return response()->json(['message' => 'Your account has been banned.'], 403);
        }

        // Shares one definition with the Inertia payload so /user and the
        // initial page load can never disagree about the user's capabilities.
        return response()->json(HandleInertiaRequests::userPayload($user));
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
        if ($request->header('X-Inertia')) {
            return redirect('/');
        }

        return response()->json(['message' => 'Logged out']);
    }

    /**
     * Revoke the active Sanctum PersonalAccessToken (for mobile / Bearer auth)
     * or log out the stateful web session.
     */
    public function apiLogout(Request $request)
    {
        $user = $request->user() ?? Auth::guard('sanctum')->user();
        $accessToken = $user?->currentAccessToken();

        if ($accessToken instanceof PersonalAccessToken) {
            $accessToken->delete();
        } else {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
        }

        return response()->json([
            'ok' => true,
            'message' => 'Logged out',
        ]);
    }

    /**
     * Revoke all mobile Sanctum PersonalAccessTokens belonging to the user.
     */
    public function apiLogoutAllDevices(Request $request)
    {
        $user = $request->user() ?? Auth::guard('sanctum')->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $revoked = 0;
        foreach ($user->tokens()->get() as $token) {
            if ($token->abilities === ['mobile'] || in_array('mobile', $token->abilities ?? [], true)) {
                $token->delete();
                $revoked++;
            }
        }

        return response()->json([
            'ok' => true,
            'revoked_count' => $revoked,
            'message' => 'Logged out from all devices',
        ]);
    }
}
