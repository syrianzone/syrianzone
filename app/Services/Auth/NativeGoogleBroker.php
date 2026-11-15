<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Cache\DatabaseStore;
use Illuminate\Cache\RedisStore;
use Illuminate\Cache\Repository;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class NativeGoogleBroker
{
    public const CALLBACK = 'zone.syrian.ios:/oauth/google';

    public const CONTEXT = 'auth.native_google';

    public function __construct(private readonly Repository $cache) {}

    public static function digest(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    public static function isDigest(mixed $value): bool
    {
        if (! is_string($value) || ! preg_match('/^[A-Za-z0-9_-]{43}$/D', $value)) {
            return false;
        }

        $decoded = base64_decode(strtr($value, '-_', '+/').'=', true);

        return is_string($decoded) && strlen($decoded) === 32 && hash_equals(self::digest($decoded), $value);
    }

    public function startParameters(Request $request): ?array
    {
        $query = $request->query();
        $keys = array_keys($query);
        sort($keys);
        if (! $this->uniqueQuery($request) || $keys !== ['code_challenge', 'code_challenge_method', 'state'] || ! self::isDigest($query['code_challenge'] ?? null)
            || ($query['code_challenge_method'] ?? null) !== 'S256' || ! is_string($query['state'] ?? null) || ! preg_match('/^[a-f0-9]{64}$/D', $query['state'])) {
            return null;
        }

        return ['challenge' => $query['code_challenge'], 'state' => $query['state']];
    }

    public function uniqueQuery(Request $request): bool
    {
        $query = $request->server('QUERY_STRING', '');
        if (! is_string($query) || strlen($query) > 8192) {
            return false;
        }
        $names = [];
        foreach (explode('&', $query) as $pair) {
            $name = urldecode(explode('=', $pair, 2)[0]);
            if (! preg_match('/^[A-Za-z][A-Za-z0-9_]*$/D', $name) || isset($names[$name]) || count($names) >= 32) {
                return false;
            }
            $names[$name] = true;
        }

        return true;
    }

    public function ensureAvailable(): void
    {
        // These configured stores share grants and atomic locks across the
        // production blue/green containers. Process-local stores fail closed.
        $store = $this->cache->getStore();
        if (! $store instanceof DatabaseStore && ! $store instanceof RedisStore) {
            throw new RuntimeException('A shared native authentication cache is required.');
        }
    }

    public function begin(Request $request, array $parameters, string $upstreamState): void
    {
        $request->session()->put(self::CONTEXT, $parameters + [
            'upstream_state' => $upstreamState, 'expires_at' => now()->timestamp + 600,
        ]);
    }

    public function validContext(mixed $context): bool
    {
        return is_array($context) && self::isDigest($context['challenge'] ?? null)
            && is_string($context['state'] ?? null) && preg_match('/^[a-f0-9]{64}$/D', $context['state'])
            && is_string($context['upstream_state'] ?? null) && strlen($context['upstream_state']) <= 512 && $context['upstream_state'] !== ''
            && is_int($context['expires_at'] ?? null);
    }

    public function clear(Request $request, array $context): void
    {
        $request->session()->forget(self::CONTEXT);
        $current = $request->session()->get('state');
        if (is_string($current) && hash_equals($context['upstream_state'], $current)) {
            $request->session()->forget('state');
        }
    }

    public function issue(User $user, string $providerSub, array $context): ?string
    {
        if (! $this->validContext($context) || $context['expires_at'] <= now()->timestamp) {
            return null;
        }
        $this->ensureAvailable();
        $code = self::digest(random_bytes(32));
        $key = $this->key($code);
        if (! $this->cache->put($key, [
            'user_id' => $user->id, 'provider_sub' => $providerSub,
            'challenge' => $context['challenge'], 'state' => $context['state'], 'expires_at' => now()->timestamp + 60,
        ], 60)) {
            throw new RuntimeException('Native authentication handoff could not be stored.');
        }
        if ($context['expires_at'] <= now()->timestamp) {
            // Cache writes can also wait. Never return a handoff created after
            // the browser attempt expired, even if its record was stored.
            $this->cache->add($key.':consumed', true, 120);
            if (! $this->cache->forget($key)) {
                throw new RuntimeException('Expired native authentication handoff could not be removed.');
            }

            return null;
        }

        return $code;
    }

    public function redeem(#[\SensitiveParameter] string $code, #[\SensitiveParameter] string $verifier, string $state, ?string $deviceName): ?array
    {
        $this->ensureAvailable();
        $key = $this->key($code);
        $lock = $this->cache->getStore()->lock($key.':lock', 30);
        if (! $lock->get()) {
            throw new RuntimeException('Native authentication handoff is busy.');
        }

        try {
            $grant = $this->cache->get($key);
            if (! is_array($grant) || ! is_int($grant['user_id'] ?? null) || ! is_string($grant['provider_sub'] ?? null) || $grant['provider_sub'] === ''
                || ! is_int($grant['expires_at'] ?? null) || $grant['expires_at'] <= now()->timestamp
                || ! self::isDigest($grant['challenge'] ?? null) || ! is_string($grant['state'] ?? null)
                || ! hash_equals($grant['state'], $state) || ! hash_equals($grant['challenge'], self::digest(hash('sha256', $verifier, true)))) {
                return null;
            }

            // The atomic claim outlives the absolute grant expiry and survives
            // later database failures or an expired lock lease. DatabaseStore
            // forget can report success even when it deleted no row.
            if (! $this->cache->add($key.':consumed', true, 120)) {
                return null;
            }
            if (! $this->cache->forget($key)) {
                throw new RuntimeException('Native authentication handoff could not be consumed.');
            }

            return DB::transaction(function () use ($grant, $deviceName): ?array {
                $user = User::query()->whereKey($grant['user_id'])->lockForUpdate()->first();
                if (! $user || $user->is_banned || ! is_string($user->google_id) || ! hash_equals($grant['provider_sub'], $user->google_id) || $grant['expires_at'] <= now()->timestamp) {
                    return null;
                }

                return app(MobileSessionTokens::class)->issue($user, $deviceName);
            });
        } finally {
            $lock->release();
        }
    }

    private function key(#[\SensitiveParameter] string $code): string
    {
        return 'native-google-handoff:'.hash('sha256', $code);
    }
}
