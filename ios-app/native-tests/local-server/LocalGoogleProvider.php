<?php

declare(strict_types=1);

namespace NativeTests\LocalServer;

use App\Models\User;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\CurlHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Promise\RejectedPromise;
use Laravel\Socialite\Two\GoogleProvider;
use Psr\Http\Message\RequestInterface;
use RuntimeException;

/** Local upstream transport only. Installed Socialite redirect/state/user mapping remain intact. */
final class LocalGoogleProvider extends GoogleProvider
{
    private const ORIGIN = 'https://127.0.0.1:9443';

    private function guard(): void
    {
        $runtime = dirname(__DIR__, 2).'/.expo/local-fixture';
        if (! app()->environment('testing') || config('app.url') !== self::ORIGIN
            || config('database.default') !== 'sqlite'
            || config('database.connections.sqlite.database') !== $runtime.'/database.sqlite'
            || $this->redirectUrl !== self::ORIGIN.'/auth/google/callback'
            || ! $this->request->isSecure() || $this->request->getSchemeAndHttpHost() !== self::ORIGIN
            || $this->request->ip() !== '127.0.0.1'
            || ! is_file($runtime.'/tls/ca.pem')) {
            throw new RuntimeException('The simulated provider requires the isolated HTTPS fixture.');
        }
    }

    protected function getAuthUrl($state)
    {
        $this->guard();

        return $this->buildAuthUrlFromBase(self::ORIGIN.'/__native_fixture/google/authorize', $state);
    }

    protected function getTokenUrl()
    {
        $this->guard();

        return self::ORIGIN.'/__native_fixture/google/token';
    }

    protected function getUserByToken($token)
    {
        $this->guard();
        $member = User::withTrashed()->find(101);
        if (! $member || $member->email !== 'member@native-fixture.invalid') {
            throw new RuntimeException('The existing synthetic member is unavailable.');
        }
        $response = $this->getHttpClient()->get(self::ORIGIN.'/__native_fixture/google/userinfo', [
            'headers' => ['Accept' => 'application/json', 'Authorization' => 'Bearer '.$token],
        ]);

        return json_decode((string) $response->getBody(), true, flags: JSON_THROW_ON_ERROR);
    }

    public function setHttpClient(Client $client)
    {
        // The real controller installs its standard client. Keep this test driver confined locally.
        $this->httpClient = $this->localClient();

        return $this;
    }

    protected function getHttpClient()
    {
        return $this->httpClient ??= $this->localClient();
    }

    private function localClient(): Client
    {
        $this->guard();
        $curl = new CurlHandler;
        $handler = HandlerStack::create(function (RequestInterface $request, array $options) use ($curl) {
            $uri = $request->getUri();
            if ($uri->getScheme() !== 'https' || $uri->getHost() !== '127.0.0.1' || $uri->getPort() !== 9443
                || ! in_array($uri->getPath(), ['/__native_fixture/google/token', '/__native_fixture/google/userinfo'], true)) {
                return new RejectedPromise(new RuntimeException('External provider transport is disabled in the fixture.'));
            }

            return $curl($request, $options);
        });

        return new Client([
            'handler' => $handler, 'verify' => dirname(__DIR__, 2).'/.expo/local-fixture/tls/ca.pem',
            'timeout' => 8, 'connect_timeout' => 3, 'allow_redirects' => false,
        ]);
    }
}
