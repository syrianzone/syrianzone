<?php

namespace App\Services;

use App\Exceptions\XAmbiguousException;
use App\Exceptions\XConfigurationException;
use App\Exceptions\XPermanentException;
use App\Exceptions\XTransientException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use League\OAuth1\Client\Credentials\TokenCredentials;
use League\OAuth1\Client\Server\X;

class XApiClient
{
    public function createPost(string $text): string
    {
        if (! $this->isConfigured()) {
            throw new XConfigurationException('X automation credentials are incomplete');
        }

        $this->assertExpectedUser();

        $url = rtrim(config('services.x_tierlist.base_url'), '/').'/2/tweets';
        try {
            $response = $this->request('POST', $url)->post($url, ['text' => $text]);
        } catch (ConnectionException) {
            throw new XAmbiguousException('X create-post request ended without a response');
        }

        if ($response->status() === 201) {
            $postId = $response->json('data.id');
            if (is_string($postId) && $postId !== '') {
                return $postId;
            }

            throw new XAmbiguousException('X API accepted the request without a post ID', 201);
        }

        if ($response->status() === 429) {
            throw new XTransientException('X API rate limited the post', 429);
        }

        if ($response->serverError()) {
            throw new XAmbiguousException('X API returned an ambiguous server response', $response->status());
        }

        throw new XPermanentException('X API rejected the post', $response->status());
    }

    public function isConfigured(): bool
    {
        if (! config('services.x_tierlist.enabled')) {
            return false;
        }

        foreach (['api_key', 'api_secret', 'access_token', 'access_token_secret', 'expected_user_id'] as $key) {
            $value = config("services.x_tierlist.{$key}");
            if (! is_string($value) || trim($value) === '') {
                return false;
            }
        }

        return true;
    }

    private function assertExpectedUser(): void
    {
        $url = rtrim(config('services.x_tierlist.base_url'), '/').'/2/users/me';

        try {
            $response = $this->request('GET', $url)->get($url);
        } catch (ConnectionException) {
            throw new XTransientException('X account verification ended without a response');
        }

        if ($response->status() === 429 || $response->serverError()) {
            throw new XTransientException('X account verification is temporarily unavailable', $response->status());
        }

        if (! $response->successful()) {
            throw new XPermanentException('X API rejected account verification', $response->status());
        }

        $actualUserId = $response->json('data.id');
        $expectedUserId = (string) config('services.x_tierlist.expected_user_id');
        if (! is_string($actualUserId) || ! hash_equals($expectedUserId, $actualUserId)) {
            throw new XPermanentException('X credentials belong to an unexpected account', $response->status());
        }
    }

    private function request(string $method, string $url): PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->connectTimeout(config('services.x_tierlist.connect_timeout'))
            ->timeout(config('services.x_tierlist.timeout'))
            ->withHeaders([
                'Authorization' => $this->authorizationHeader($method, $url),
            ]);
    }

    private function authorizationHeader(string $method, string $url): string
    {
        $server = new X([
            'identifier' => config('services.x_tierlist.api_key'),
            'secret' => config('services.x_tierlist.api_secret'),
        ]);
        $token = new TokenCredentials;
        $token->setIdentifier(config('services.x_tierlist.access_token'));
        $token->setSecret(config('services.x_tierlist.access_token_secret'));

        return $server->getHeaders($token, $method, $url)['Authorization'];
    }
}
