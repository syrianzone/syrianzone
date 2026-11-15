<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Auth\GoogleAccountResolver;
use App\Services\Auth\MobileSessionTokens;
use App\Services\Auth\NativeGoogleBroker;
use App\Services\Auth\SuperadminPasswordLogin;
use App\Support\Agents\TokenAbilities;
use DanHarrin\LivewireRateLimiting\Exceptions\TooManyRequestsException;
use GuzzleHttp\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as GoogleUser;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    public function redirectToProvider(Request $request)
    {
        $request->session()->forget([NativeGoogleBroker::CONTEXT, 'state']);
        if ($request->has('redirect')) {
            $redirect = $request->query('redirect');
            // Reject scheme-relative URLs (//evil.com) and non-path values to prevent open-redirect
            if (is_string($redirect) && str_starts_with($redirect, '/') && ! str_starts_with($redirect, '//')) {
                session(['url.intended' => $redirect]);
            }
        }

        return Socialite::driver('google')->redirect();
    }

    public function nativeGoogleStart(Request $request, NativeGoogleBroker $broker)
    {
        $parameters = $broker->startParameters($request);
        if (! $parameters) {
            return $this->nativeNoStore(response()->json(['message' => 'بيانات تسجيل الدخول غير صالحة.'], 422));
        }

        try {
            $broker->ensureAvailable();
            $request->session()->forget([NativeGoogleBroker::CONTEXT, 'state']);
            $response = Socialite::driver('google')->redirect();
            $upstreamState = $request->session()->get('state');
            if (! is_string($upstreamState) || $upstreamState === '' || strlen($upstreamState) > 512) {
                throw new \RuntimeException('Google browser state was not created.');
            }
            $broker->begin($request, $parameters, $upstreamState);

            return $this->nativeNoStore($response);
        } catch (\Throwable) {
            return $this->nativeNoStore(response()->json(['message' => 'تعذّر بدء تسجيل الدخول. حاول لاحقاً.'], 503));
        }
    }

    public function handleProviderCallback(Request $request, NativeGoogleBroker $broker)
    {
        $expectedState = $request->session()->get('state');
        $incomingState = $request->query('state');
        $native = $request->session()->get(NativeGoogleBroker::CONTEXT);
        // Socialite pulls state even when it mismatches. Do not let a stale
        // callback consume another browser or native attempt's state.
        if (! is_string($expectedState) || $expectedState === '' || ! is_string($incomingState) || ! hash_equals($expectedState, $incomingState) || ! $broker->uniqueQuery($request)) {
            return $this->nativeNoStore(redirect('/?error=auth_failed'));
        }
        if ($native !== null) {
            if (! $broker->validContext($native) || ! is_string($incomingState) || ! hash_equals($native['upstream_state'], $incomingState) || ! is_string($expectedState) || ! hash_equals($expectedState, $incomingState)) {
                return $this->nativeNoStore(redirect('/?error=auth_failed'));
            }
            if ($native['expires_at'] <= now()->timestamp) {
                $broker->clear($request, $native);

                return $this->nativeGoogleResult($native['state'], error: 'auth_expired');
            }

            return $this->nativeGoogleCallback($request, $broker, $native);
        }

        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (\Exception $e) {
            return $this->nativeNoStore(redirect('/?error=auth_failed'));
        }

        $email = $googleUser->getEmail();
        if (! is_string($email) || $email === '') {
            return $this->nativeNoStore(redirect('/?error=auth_failed'));
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
            return $this->nativeNoStore(redirect('/?error=banned'));
        }

        Auth::login($user, true);

        return $this->nativeNoStore(redirect()->intended('/dashboard'));
    }

    private function nativeGoogleCallback(Request $request, NativeGoogleBroker $broker, array $context): Response
    {
        try {
            if ($request->has('error') || ! is_string($request->query('code')) || strlen($request->query('code')) > 4096 || $request->query('code') === '') {
                $broker->clear($request, $context);

                return $this->nativeGoogleResult($context['state'], error: 'auth_failed');
            }
            $googleUser = Socialite::driver('google')->setHttpClient(new Client(['timeout' => 8, 'connect_timeout' => 3]))->user();
            // Installed Socialite returns cached users before checking state.
            // A native handoff requires its real stateful validation path.
            if ($request->session()->get('state') !== null) {
                $broker->clear($request, $context);

                return $this->nativeGoogleResult($context['state'], error: 'auth_failed');
            }
            $broker->clear($request, $context);
            if ($context['expires_at'] <= now()->timestamp) {
                return $this->nativeGoogleResult($context['state'], error: 'auth_expired');
            }
            $raw = $googleUser instanceof GoogleUser ? $googleUser->getRaw() : [];
            $email = $googleUser->getEmail();
            $sub = $googleUser->getId();
            if (! in_array($raw['email_verified'] ?? null, [true, 'true'], true) || ! is_string($email) || strlen($email) > 255 || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return $this->nativeGoogleResult($context['state'], error: 'unverified_email');
            }
            if (! is_string($sub) || $sub === '' || strlen($sub) > 255 || ! is_string($raw['sub'] ?? null) || ! hash_equals($raw['sub'], $sub)) {
                return $this->nativeGoogleResult($context['state'], error: 'auth_failed');
            }

            $user = $this->upsertAndResolveGoogleUser($email, $sub, $googleUser->getName(), $googleUser->getAvatar());
            if ($user->is_banned) {
                return $this->nativeGoogleResult($context['state'], error: 'banned');
            }

            $code = $broker->issue($user, $sub, $context);

            return $code === null ? $this->nativeGoogleResult($context['state'], error: 'auth_expired')
                : $this->nativeGoogleResult($context['state'], code: $code);
        } catch (\Throwable) {
            $broker->clear($request, $context);

            return $this->nativeGoogleResult($context['state'], error: 'auth_failed');
        }
    }

    public function nativeGoogleToken(Request $request, NativeGoogleBroker $broker): Response
    {
        $validator = Validator::make($request->only('code', 'code_verifier', 'state', 'device_name'), [
            'code' => ['required', 'string', fn ($attribute, $value, $fail) => NativeGoogleBroker::isDigest($value) ?: $fail('رمز تسجيل الدخول غير صالح.')],
            'code_verifier' => ['required', 'string', 'regex:/^[A-Za-z0-9._~-]{43,128}$/D'],
            'state' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/D'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ], ['required' => 'بيانات تسجيل الدخول غير مكتملة.', 'string' => 'بيانات تسجيل الدخول غير صالحة.', 'regex' => 'بيانات تسجيل الدخول غير صالحة.', 'max' => 'اسم الجهاز طويل جداً.']);
        if (strlen($request->getContent()) > 4096 || $validator->fails()) {
            return $this->nativeNoStore(response()->json(['message' => 'بيانات تسجيل الدخول غير صالحة.', 'errors' => $validator->errors()], 422));
        }
        $input = $validator->validated();
        try {
            $session = $broker->redeem($input['code'], $input['code_verifier'], $input['state'], $input['device_name'] ?? null);

            return $session ? $this->nativeNoStore(response()->json($session))
                : $this->nativeNoStore(response()->json(['message' => 'تعذّر إكمال تسجيل الدخول. ابدأ المحاولة من جديد.'], 401));
        } catch (\Throwable) {
            return $this->nativeNoStore(response()->json(['message' => 'تعذّر إكمال تسجيل الدخول الآن. حاول لاحقاً.'], 503));
        }
    }

    private function nativeGoogleResult(string $state, ?string $code = null, ?string $error = null): Response
    {
        return $this->nativeNoStore(redirect()->away(NativeGoogleBroker::CALLBACK.'?'.http_build_query($code !== null ? ['code' => $code, 'state' => $state] : ['error' => $error, 'state' => $state])));
    }

    private function nativeNoStore(Response $response): Response
    {
        $response->headers->set('Cache-Control', 'no-store, private');
        $response->headers->set('Referrer-Policy', 'no-referrer');

        return $response;
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
            return response()->json(['message' => 'تم حظر حسابك.'], 403);
        }

        return response()->json(app(MobileSessionTokens::class)->issue($user, $validated['device_name'] ?? null));
    }

    public function superadminToken(Request $request, SuperadminPasswordLogin $login): JsonResponse
    {
        try {
            // Filament counts even malformed forms and successful attempts.
            $login->consumeAttempt();
        } catch (TooManyRequestsException $exception) {
            $retryAfter = max(1, $exception->secondsUntilAvailable);

            return response()->json([
                'message' => 'محاولات تسجيل الدخول كثيرة. يرجى المحاولة لاحقاً.',
                'retry_after' => $retryAfter,
            ], 429)->header('Retry-After', (string) $retryAfter)->header('Cache-Control', 'no-store, private');
        }

        $validator = Validator::make($request->only('email', 'password', 'device_name'), [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ], [
            'email.required' => 'يرجى إدخال البريد الإلكتروني.',
            'email.string' => 'يرجى إدخال بريد إلكتروني صحيح.',
            'email.email' => 'يرجى إدخال بريد إلكتروني صحيح.',
            'password.required' => 'يرجى إدخال كلمة المرور.',
            'password.string' => 'يرجى إدخال كلمة مرور صحيحة.',
            'device_name.string' => 'اسم الجهاز غير صحيح.',
            'device_name.max' => 'اسم الجهاز طويل جداً.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'يرجى التحقق من بيانات تسجيل الدخول.',
                'errors' => $validator->errors(),
            ], 422)->header('Cache-Control', 'no-store, private');
        }

        $validated = $validator->validated();
        $session = $login->attempt([
            'email' => $validated['email'],
            'password' => $validated['password'],
        ], $validated['device_name'] ?? null);

        if (! $session) {
            $message = 'بيانات تسجيل الدخول غير صحيحة أو لا يمكن لهذا الحساب دخول لوحة الإدارة.';

            return response()->json(['message' => $message, 'errors' => ['email' => [$message]]], 401)
                ->header('Cache-Control', 'no-store, private');
        }

        return response()->json($session)->header('Cache-Control', 'no-store, private');
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
        return app(GoogleAccountResolver::class)->resolve($email, $googleId, $name, $avatar);
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
