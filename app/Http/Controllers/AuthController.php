<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Agents\TokenAbilities;
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
     * Accepts either a Google `id_token` or a Google `access_token`. Either way
     * the token's audience must be one of our own client ids
     * (`services.google.allowed_client_ids`), checked against Google's
     * tokeninfo endpoint; anything that cannot be verified is refused. The
     * user is resolved against the same `users` table as the web app.
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

        // Without a list of our own client ids there is nothing to check the
        // token's audience against, and a Google token minted for any other
        // app would be accepted as a login. Refuse rather than fail open.
        if (empty($allowedClientIds)) {
            return response()->json(['message' => 'Google sign-in is not configured.'], 503);
        }

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
            if (! in_array($aud, $allowedClientIds, true)) {
                return response()->json(['message' => 'Invalid Google token audience.'], 401);
            }

            $email = (string) $payload['email'];
            $googleId = isset($payload['sub']) ? (string) $payload['sub'] : null;
            $name = isset($payload['name']) && trim((string) $payload['name']) !== ''
                ? (string) $payload['name']
                : explode('@', $email)[0];
            $avatar = isset($payload['picture']) ? (string) $payload['picture'] : null;
        } else {
            // An access token says nothing about which app it was issued to,
            // so its audience is established first, from tokeninfo, and any
            // failure to establish it is a refusal. userinfo alone would accept
            // a token that some unrelated app obtained for the same user.
            try {
                $tokenInfoResponse = Http::timeout(8)->get('https://oauth2.googleapis.com/tokeninfo', [
                    'access_token' => $validated['access_token'],
                ]);
            } catch (\Throwable $e) {
                return response()->json(['message' => 'Unable to verify Google access_token at this time.'], 503);
            }

            if (! $tokenInfoResponse->successful()) {
                return response()->json(['message' => 'Invalid or expired Google access_token.'], 401);
            }

            $tokenInfo = $tokenInfoResponse->json();
            $aud = is_array($tokenInfo) ? (string) ($tokenInfo['aud'] ?? $tokenInfo['azp'] ?? '') : '';
            if (! in_array($aud, $allowedClientIds, true)) {
                return response()->json(['message' => 'Invalid Google token audience.'], 401);
            }

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

            // Both answers must describe the same Google account.
            $tokenSub = (string) ($tokenInfo['sub'] ?? '');
            if ($tokenSub !== '' && $tokenSub !== (string) ($payload['sub'] ?? '')) {
                return response()->json(['message' => 'Invalid or expired Google access_token.'], 401);
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
            return response()->json(['message' => 'تم حظر حسابك.'], 403);
        }

        $deviceName = trim((string) ($validated['device_name'] ?? 'mobile')) ?: 'mobile';
        $newAccessToken = $user->createToken($deviceName, [TokenAbilities::MOBILE]);

        return response()->json([
            'token' => $newAccessToken->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $newAccessToken->accessToken->expires_at?->toIso8601String(),
            'user' => $user->toAuthPayload(),
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
        // Resolve by immutable google_id first so an unrelated account cannot
        // pre-claim a victim's email. Fall back to matching by email only when
        // google_id is null (pre-seeded/legacy accounts and SUPERADMIN_EMAIL).
        // withTrashed: a soft-deleted account still holds the unique email.
        $user = null;
        if ($googleId !== null && $googleId !== '') {
            $user = User::withTrashed()->where('google_id', $googleId)->first();
        }
        if (! $user) {
            $user = User::withTrashed()
                ->where('email', $email)
                ->whereNull('google_id')
                ->first();
        }

        $superadminEmail = config('app.superadmin_email');
        $isSuperAdmin = $superadminEmail !== '' && $email === $superadminEmail;

        if ($user) {
            if ($user->trashed()) {
                $user->restore();
            }

            if ($googleId !== null && $googleId !== '' && $user->google_id === null) {
                $user->google_id = $googleId;
            }

            if ($user->email !== $email && ! User::withTrashed()->where('email', $email)->where('id', '!=', $user->id)->exists()) {
                $user->email = $email;
            }

            if ($isSuperAdmin) {
                $user->role = 'superadmin';
            }

            // Refresh the Google avatar only when the user has not uploaded a custom
            // one; a custom avatar lives under our media disk's avatars/ prefix.
            if (! $this->hasCustomAvatar($user) && $avatar !== null) {
                $user->avatar_url = $avatar;
            }

            $user->save();

            return $user;
        }

        // Self-registration: unknown emails become regular users so the
        // community can contribute (places, comments).
        return User::create([
            'email' => $email,
            'google_id' => $googleId,
            'name' => $name ?: explode('@', $email)[0],
            'password' => bcrypt(str()->random(16)),
            'role' => $isSuperAdmin ? 'superadmin' : 'user',
            'avatar_url' => $avatar,
        ]);
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
        $user = $request->user();

        if ($user && $user->is_banned) {
            return response()->json(['message' => 'تم حظر حسابك.'], 403);
        }

        // Shares one definition with the Inertia payload so /user and the
        // initial page load can never disagree about the user's capabilities.
        return response()->json($user?->toAuthPayload());
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
        $user = $request->user();
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

    public function apiLogoutAllDevices(Request $request)
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $revoked = 0;
        foreach ($user->tokens()->get() as $token) {
            if (TokenAbilities::isMobileToken($token)) {
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
