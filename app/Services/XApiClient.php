<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class XApiClient
{
    private bool $identityVerified = false;

    public function post(string $text): string
    {
        $token = $this->accessToken();
        $this->verifyIdentity($token);
        $response = $this->request($token)->post('https://api.x.com/2/tweets', ['text' => $text]);
        $response->throw();

        return (string) $response->json('data.id');
    }

    private function verifyIdentity(string $token): void
    {
        if ($this->identityVerified) {
            return;
        }

        $expected = strtolower((string) config('services.x.username'));
        $actual = strtolower((string) $this->request($token)->get('https://api.x.com/2/users/me')->throw()->json('data.username'));
        if (! $expected || $actual !== $expected) {
            throw new RuntimeException("X token belongs to @{$actual}, expected @{$expected}.");
        }

        $this->identityVerified = true;
    }

    private function request(string $token): PendingRequest
    {
        return Http::acceptJson()->withToken($token)->timeout(20)->retry(2, 500);
    }

    private function accessToken(): string
    {
        if ($token = config('services.x.access_token')) {
            return $token;
        }

        $encrypted = Cache::get('x.user_access_token');
        $stored = $encrypted ? json_decode(Crypt::decryptString($encrypted), true, flags: JSON_THROW_ON_ERROR) : null;
        if (is_array($stored) && ($stored['expires_at'] ?? 0) > now()->addMinute()->timestamp) {
            return $stored['access_token'];
        }

        $refreshToken = $stored['refresh_token'] ?? config('services.x.refresh_token');
        if (! $refreshToken || ! config('services.x.client_id')) {
            throw new RuntimeException('X credentials are missing. Set X_ACCESS_TOKEN, or set X_CLIENT_ID and X_REFRESH_TOKEN.');
        }

        $request = Http::asForm()->timeout(20);
        if (config('services.x.client_secret')) {
            $request = $request->withBasicAuth(config('services.x.client_id'), config('services.x.client_secret'));
        }

        $response = $request->post('https://api.x.com/2/oauth2/token', [
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token',
            'client_id' => config('services.x.client_id'),
        ])->throw()->json();

        $token = [
            'access_token' => $response['access_token'],
            'refresh_token' => $response['refresh_token'] ?? $refreshToken,
            'expires_at' => now()->addSeconds((int) ($response['expires_in'] ?? 7200))->timestamp,
        ];
        Cache::forever('x.user_access_token', Crypt::encryptString(json_encode($token, JSON_THROW_ON_ERROR)));

        return $token['access_token'];
    }
}
