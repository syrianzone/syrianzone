<?php

namespace App\Http\Controllers;

use App\Models\MobileAuthCode;
use App\Models\User;
use App\Services\GoogleAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Throwable;

class MobileAuthController extends Controller
{
    public function redirectToGoogle(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'redirect_uri' => [
                'required',
                'string',
                Rule::in(config('mobile-auth.allowed_redirect_uris', [])),
            ],
            'state' => ['required', 'string', 'regex:/\A[A-Za-z0-9\-._~]{43,128}\z/'],
            'code_challenge' => ['required', 'string', 'regex:/\A[A-Za-z0-9\-_]{43}\z/'],
            'code_challenge_method' => ['required', Rule::in(['S256'])],
        ]);

        if (! $this->googleIsConfigured()) {
            return $this->redirectToUri($validated['redirect_uri'], [
                'error' => 'auth_unavailable',
                'state' => $validated['state'],
            ]);
        }

        $oauthState = Str::random(64);

        MobileAuthCode::create([
            'oauth_state_hash' => hash('sha256', $oauthState),
            'app_state' => $validated['state'],
            'redirect_uri' => $validated['redirect_uri'],
            'code_challenge' => $validated['code_challenge'],
            'expires_at' => now()->addMinutes($this->positiveConfig('authorization_ttl_minutes')),
        ]);

        return $this->googleProvider()
            ->stateless()
            ->with(['state' => $oauthState])
            ->redirect();
    }

    public function handleGoogleCallback(
        Request $request,
        GoogleAccountService $accounts,
    ): RedirectResponse|JsonResponse {
        $validated = $request->validate([
            'state' => ['required', 'string', 'regex:/\A[A-Za-z0-9\-._~]{43,128}\z/'],
            'code' => ['nullable', 'string', 'max:2048'],
            'error' => ['nullable', 'string', 'max:100'],
        ]);

        $record = MobileAuthCode::query()
            ->where('oauth_state_hash', hash('sha256', $validated['state']))
            ->whereNull('authorized_at')
            ->where('expires_at', '>', now())
            ->first();

        if (! $record) {
            return response()->json(['error' => 'invalid_login'], 410);
        }

        $claimed = MobileAuthCode::query()
            ->whereKey($record->getKey())
            ->whereNull('authorized_at')
            ->where('expires_at', '>', now())
            ->update(['authorized_at' => now(), 'updated_at' => now()]);

        if ($claimed !== 1) {
            return response()->json(['error' => 'invalid_login'], 410);
        }

        $record->refresh();

        if (isset($validated['error']) || empty($validated['code'])) {
            return $this->redirectToApp($record, ['error' => 'auth_failed']);
        }

        try {
            $googleUser = $this->googleProvider()->stateless()->user();
        } catch (Throwable) {
            return $this->redirectToApp($record, ['error' => 'auth_failed']);
        }

        $user = $accounts->resolve($googleUser);

        if (! $user) {
            return $this->redirectToApp($record, ['error' => 'access_denied']);
        }

        $exchangeCode = $this->randomToken();
        $record->forceFill([
            'exchange_code_hash' => hash('sha256', $exchangeCode),
            'user_id' => $user->getKey(),
            'exchange_expires_at' => now()->addMinutes($this->positiveConfig('exchange_ttl_minutes')),
        ])->save();

        return $this->redirectToApp($record, ['code' => $exchangeCode]);
    }

    public function exchange(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'regex:/\A[A-Za-z0-9\-._~]{43,128}\z/'],
            'code_verifier' => ['required', 'string', 'regex:/\A[A-Za-z0-9\-._~]{43,128}\z/'],
            'device_name' => ['nullable', 'string', 'max:80'],
        ]);

        $challenge = rtrim(strtr(
            base64_encode(hash('sha256', $validated['code_verifier'], true)),
            '+/',
            '-_',
        ), '=');

        $result = DB::transaction(function () use ($validated, $challenge) {
            $codeHash = hash('sha256', $validated['code']);
            $claimed = MobileAuthCode::query()
                ->where('exchange_code_hash', $codeHash)
                ->where('code_challenge', $challenge)
                ->whereNotNull('authorized_at')
                ->whereNull('exchanged_at')
                ->where('exchange_expires_at', '>', now())
                ->update(['exchanged_at' => now(), 'updated_at' => now()]);

            if ($claimed !== 1) {
                return null;
            }

            $record = MobileAuthCode::query()
                ->with('user')
                ->where('exchange_code_hash', $codeHash)
                ->first();

            if (! $record) {
                return null;
            }

            $user = $record->user;

            if (! $user || $user->is_banned) {
                return null;
            }

            $expiresAt = now()->addMinutes($this->positiveConfig('token_ttl_minutes'));
            $deviceName = trim((string) ($validated['device_name'] ?? '')) ?: 'unknown';
            $token = $user->createToken('mobile:'.$deviceName, ['mobile'], $expiresAt);

            return compact('user', 'token', 'expiresAt');
        }, 3);

        if (! $result) {
            return response()->json(['error' => 'invalid_grant'], 422);
        }

        return response()->json([
            'token' => $result['token']->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $result['expiresAt']->toIso8601String(),
            'user' => $this->userPayload($result['user']),
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->is_banned) {
            $user->tokens()->delete();

            return response()->json(['error' => 'account_disabled'], 403);
        }

        return response()->json(['user' => $this->userPayload($user)]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        $user->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    private function googleProvider(): GoogleProvider
    {
        $config = array_replace((array) config('services.google'), [
            'redirect' => $this->googleRedirectUrl(),
        ]);

        return Socialite::buildProvider(GoogleProvider::class, $config);
    }

    private function googleRedirectUrl(): string
    {
        return (string) (config('mobile-auth.google_redirect_url')
          ?: route('mobile.auth.google.callback'));
    }

    private function redirectToApp(MobileAuthCode $record, array $query): RedirectResponse
    {
        $query['state'] = $record->app_state;

        return $this->redirectToUri($record->redirect_uri, $query);
    }

    private function redirectToUri(string $redirectUri, array $query): RedirectResponse
    {
        $fragment = parse_url($redirectUri, PHP_URL_FRAGMENT);
        $base = $fragment === null
          ? $redirectUri
          : substr($redirectUri, 0, -strlen($fragment) - 1);
        $separator = str_contains($base, '?') ? '&' : '?';
        $url = $base.$separator.http_build_query($query, '', '&', PHP_QUERY_RFC3986);

        if ($fragment !== null) {
            $url .= '#'.$fragment;
        }

        return redirect()->away($url);
    }

    private function googleIsConfigured(): bool
    {
        return filled(config('services.google.client_id'))
            && filled(config('services.google.client_secret'));
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
            'role' => $user->role,
            'is_banned' => $user->is_banned,
            'permissions' => array_values($user->permissions ?? []),
            'settings' => (object) ($user->settings ?? []),
        ];
    }

    private function randomToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    private function positiveConfig(string $key): int
    {
        return max(1, (int) config('mobile-auth.'.$key));
    }
}
