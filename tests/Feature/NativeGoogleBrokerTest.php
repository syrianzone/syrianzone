<?php

use App\Models\User;
use App\Services\Auth\MobileSessionTokens;
use App\Services\Auth\NativeGoogleBroker;
use Illuminate\Cache\DatabaseStore;
use Illuminate\Cache\Repository;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;

const GOOGLE_NATIVE_START = '/auth/google/native';
const GOOGLE_NATIVE_EXCHANGE = '/api/v1/auth/google/native/token';
const GOOGLE_NATIVE_CALLBACK = 'zone.syrian.ios:/oauth/google';

class BrokerFixtureGoogleProvider extends GoogleProvider
{
    public static array $profile = [];

    public static int $lookups = 0;

    public static bool $fail = false;

    public static bool $cached = false;

    public static int $advanceSeconds = 0;

    public function user()
    {
        if (self::$cached) {
            $this->user = $this->mapUserToObject(self::$profile);
        }

        return parent::user();
    }

    public function getAccessTokenResponse($code)
    {
        self::$lookups++;
        if (self::$advanceSeconds) {
            test()->travel(self::$advanceSeconds)->seconds();
        }
        if (self::$fail) {
            throw new RuntimeException('Local provider failure');
        }

        return ['access_token' => 'local-upstream-access-token'];
    }

    protected function getUserByToken($token)
    {
        return self::$profile;
    }
}

class BrokerEnforcedCsrf extends ValidateCsrfToken
{
    protected function runningUnitTests()
    {
        return false;
    }
}

function brokerBase64(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

function brokerFixtureStart(array $extra = []): array
{
    $verifier = brokerBase64(random_bytes(32));
    $state = bin2hex(random_bytes(32));
    $response = test()->get(GOOGLE_NATIVE_START.'?'.http_build_query([
        'code_challenge' => brokerBase64(hash('sha256', $verifier, true)),
        'code_challenge_method' => 'S256', 'state' => $state,
    ] + $extra))->assertRedirect()->assertHeader('Cache-Control', 'no-store, private');
    $cookie = $response->getCookie(config('session.cookie'));
    if ($cookie) {
        test()->withCookie(config('session.cookie'), $cookie->getValue());
    }

    return ['verifier' => $verifier, 'state' => $state, 'upstream_state' => session('state'), 'response' => $response];
}

function brokerFixtureCallback(array $attempt): array
{
    $response = test()->get('/auth/google/callback?'.http_build_query(['state' => $attempt['upstream_state'], 'code' => 'local-upstream-code']))
        ->assertRedirect()->assertHeader('Cache-Control', 'no-store, private');
    $target = $response->headers->get('Location');
    parse_str(parse_url($target, PHP_URL_QUERY) ?? '', $params);

    return $attempt + ['response' => $response, 'target' => $target, 'params' => $params];
}

function brokerFixtureExchange(array $grant, array $overrides = [])
{
    return test()->postJson(GOOGLE_NATIVE_EXCHANGE, array_replace([
        'code' => $grant['params']['code'], 'code_verifier' => $grant['verifier'],
        'state' => $grant['state'], 'device_name' => 'Syrian Zone iOS',
    ], $overrides));
}

beforeEach(function () {
    Http::preventStrayRequests();
    config(['cache.default' => 'database', 'app.superadmin_email' => '', 'services.google.redirect' => 'https://syrian.zone/auth/google/callback']);
    app()->forgetInstance('cache.store');
    BrokerFixtureGoogleProvider::$lookups = 0;
    BrokerFixtureGoogleProvider::$fail = false;
    BrokerFixtureGoogleProvider::$cached = false;
    BrokerFixtureGoogleProvider::$advanceSeconds = 0;
    BrokerFixtureGoogleProvider::$profile = [
        'sub' => 'fixture-google-sub', 'email' => 'broker@example.test', 'email_verified' => true,
        'name' => 'Google fixture', 'picture' => 'https://example.test/avatar.png',
    ];
    Socialite::shouldReceive('driver')->with('google')->andReturnUsing(fn () => new BrokerFixtureGoogleProvider(
        app('request'), 'existing-web-client', 'server-only-fixture-secret', config('services.google.redirect'),
    ));
});

test('native Google uses the existing server callback and a fixed one-use PKCE handoff without logging in the browser', function () {
    $attempt = brokerFixtureStart();
    parse_str(parse_url($attempt['response']->headers->get('Location'), PHP_URL_QUERY), $upstream);
    expect($upstream['redirect_uri'])->toBe('https://syrian.zone/auth/google/callback')
        ->and($upstream['state'])->toBe($attempt['upstream_state'])->not->toBe($attempt['state'])
        ->and($upstream)->not->toHaveKeys(['client_secret', 'code_verifier', 'code_challenge']);
    $grant = brokerFixtureCallback($attempt);
    expect(strtok($grant['target'], '?'))->toBe(GOOGLE_NATIVE_CALLBACK)
        ->and(array_keys($grant['params']))->toBe(['code', 'state'])
        ->and($grant['params']['state'])->toBe($attempt['state'])
        ->and($grant['params']['code'])->toMatch('/^[A-Za-z0-9_-]{43}$/')
        ->and($grant['target'])->not->toContain('broker@example.test', 'local-upstream-access-token', 'server-only-fixture-secret')
        ->and(Auth::guard('web')->check())->toBeFalse()->and(PersonalAccessToken::count())->toBe(0);
    $response = brokerFixtureExchange($grant)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('token_type', 'Bearer')->assertJsonPath('expires_at', null)->assertJsonPath('user.email', 'broker@example.test');
    $token = PersonalAccessToken::findToken($response->json('token'));
    expect($token->abilities)->toBe(['mobile'])->and($token->name)->toBe('Syrian Zone iOS')
        ->and(Auth::guard('web')->check())->toBeFalse()->and(BrokerFixtureGoogleProvider::$lookups)->toBe(1);
    brokerFixtureExchange($grant)->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');
    expect(PersonalAccessToken::count())->toBe(1);
});

test('native start rejects unbounded non-S256 duplicate or caller-selected callback fields', function (string $query) {
    $this->get(GOOGLE_NATIVE_START.'?'.$query)->assertUnprocessable()->assertHeader('Cache-Control', 'no-store, private');
    expect(BrokerFixtureGoogleProvider::$lookups)->toBe(0)->and(session('state'))->toBeNull();
})->with([
    '', 'code_challenge=a&code_challenge_method=plain&state=x',
    'code_challenge[]=x&code_challenge_method=S256&state='.str_repeat('a', 64),
    'code_challenge='.str_repeat('a', 43).'&code_challenge_method=S256&state='.str_repeat('a', 65),
    'code_challenge='.str_repeat('a', 43).'&code_challenge_method=S256&state='.str_repeat('a', 64).'&state='.str_repeat('b', 64),
    'code_challenge='.brokerBase64(str_repeat('x', 32)).'&code_challenge_method=S256&state='.str_repeat('a', 64).'&redirect_uri=https://example.test/',
]);

test('wrong PKCE or client state cannot redeem or burn another legitimate handoff', function (string $field) {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    brokerFixtureExchange($grant, [$field => $field === 'state' ? str_repeat('b', 64) : brokerBase64(random_bytes(32))])
        ->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');
    expect(PersonalAccessToken::count())->toBe(0);
    brokerFixtureExchange($grant)->assertOk();
})->with(['state', 'code_verifier']);

test('PHP-normalized query aliases cannot collide with canonical broker parameters', function (string $alias) {
    $query = 'code_challenge='.brokerBase64(str_repeat('x', 32)).'&'.$alias.'='.brokerBase64(str_repeat('y', 32))
        .'&code_challenge_method=S256&state='.str_repeat('a', 64);
    $this->get(GOOGLE_NATIVE_START.'?'.$query)->assertUnprocessable()->assertHeader('Cache-Control', 'no-store, private');
    expect(session('state'))->toBeNull();
})->with(['code.challenge', 'code+challenge', 'code_challenge%00ignored']);

test('expired native browser context never falls through to browser login or Google resolution', function () {
    $attempt = brokerFixtureStart();
    $this->travel(601)->seconds();
    $grant = brokerFixtureCallback($attempt);
    expect($grant['params'])->toBe(['error' => 'auth_expired', 'state' => $attempt['state']])
        ->and(BrokerFixtureGoogleProvider::$lookups)->toBe(0)->and(User::count())->toBe(0)
        ->and(Auth::guard('web')->check())->toBeFalse();
});

test('a consumed native callback cannot become a browser login through a cached Socialite user', function () {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    BrokerFixtureGoogleProvider::$cached = true;
    $this->get('/auth/google/callback?'.http_build_query(['state' => $grant['upstream_state'], 'code' => 'replayed']))
        ->assertRedirect('/?error=auth_failed');
    expect(Auth::guard('web')->check())->toBeFalse()->and(PersonalAccessToken::count())->toBe(0);
});

test('a cached or stateless provider profile cannot bypass native upstream state consumption', function () {
    $attempt = brokerFixtureStart();
    BrokerFixtureGoogleProvider::$cached = true;
    $grant = brokerFixtureCallback($attempt);
    expect($grant['params'])->toBe(['error' => 'auth_failed', 'state' => $attempt['state']])
        ->and(BrokerFixtureGoogleProvider::$lookups)->toBe(0)->and(User::count())->toBe(0)
        ->and(PersonalAccessToken::count())->toBe(0)->and(Auth::guard('web')->check())->toBeFalse();
});

test('native browser expiry is rechecked after slow upstream verification before account resolution', function () {
    $attempt = brokerFixtureStart();
    $this->travel(599)->seconds();
    BrokerFixtureGoogleProvider::$advanceSeconds = 2;
    $grant = brokerFixtureCallback($attempt);
    expect($grant['params'])->toBe(['error' => 'auth_expired', 'state' => $attempt['state']])
        ->and(User::count())->toBe(0)->and(Auth::guard('web')->check())->toBeFalse();
});

test('native attempt expiry during account resolution cannot issue a new handoff', function () {
    $attempt = brokerFixtureStart();
    $this->travel(599)->seconds();
    $advanced = false;
    Event::listen('eloquent.saving: '.User::class, function () use (&$advanced) {
        if (! $advanced) {
            $advanced = true;
            test()->travel(2)->seconds();
        }
    });
    $grant = brokerFixtureCallback($attempt);
    expect($advanced)->toBeTrue()->and($grant['params'])->toBe(['error' => 'auth_expired', 'state' => $attempt['state']])
        ->and(PersonalAccessToken::count())->toBe(0)
        ->and(DB::table('cache')->where('key', 'like', '%native-google-handoff:%')->count())->toBe(0);
});

test('native attempt expiry during cache storage discards the undisclosed handoff', function () {
    $attempt = brokerFixtureStart();
    $this->travel(599)->seconds();
    $real = Cache::store();
    $storedKey = null;
    $cache = Mockery::mock(Repository::class, [$real->getStore()])->makePartial();
    $cache->shouldReceive('put')->once()->andReturnUsing(function ($key, $value, $ttl) use ($real, &$storedKey) {
        $storedKey = $key;
        $stored = $real->put($key, $value, $ttl);
        test()->travel(2)->seconds();

        return $stored;
    });
    app()->instance(NativeGoogleBroker::class, new NativeGoogleBroker($cache));
    $grant = brokerFixtureCallback($attempt);
    expect($grant['params'])->toBe(['error' => 'auth_expired', 'state' => $attempt['state']])
        ->and($storedKey)->not->toBeNull()->and(Cache::get($storedKey))->toBeNull()
        ->and(Cache::get($storedKey.':consumed'))->toBeTrue()->and(PersonalAccessToken::count())->toBe(0);
});

test('a handoff created before browser expiry keeps its own fresh sixty-second lifetime', function () {
    $attempt = brokerFixtureStart();
    $this->travel(599)->seconds();
    $grant = brokerFixtureCallback($attempt);
    $this->travel(59)->seconds();
    brokerFixtureExchange($grant)->assertOk();
    expect(PersonalAccessToken::count())->toBe(1);
});

test('provider refusal or failure returns only the fixed allowlisted app error', function (bool $upstreamFailure) {
    $attempt = brokerFixtureStart();
    BrokerFixtureGoogleProvider::$fail = $upstreamFailure;
    if ($upstreamFailure) {
        $grant = brokerFixtureCallback($attempt);
    } else {
        $response = $this->get('/auth/google/callback?'.http_build_query(['state' => $attempt['upstream_state'], 'error' => 'attacker-controlled-description']))
            ->assertRedirect()->assertHeader('Cache-Control', 'no-store, private');
        $target = $response->headers->get('Location');
        parse_str(parse_url($target, PHP_URL_QUERY), $params);
        $grant = ['params' => $params, 'target' => $target];
    }
    expect($grant['params'])->toBe(['error' => 'auth_failed', 'state' => $attempt['state']])
        ->and(strtok($grant['target'], '?'))->toBe(GOOGLE_NATIVE_CALLBACK)
        ->and(User::count())->toBe(0)->and(PersonalAccessToken::count())->toBe(0);
})->with([false, true]);

test('a duplicate callback state leaves the legitimate attempt available', function () {
    $attempt = brokerFixtureStart();
    $this->get('/auth/google/callback?state='.$attempt['upstream_state'].'&state='.$attempt['upstream_state'].'&code=duplicate')
        ->assertRedirect('/?error=auth_failed')->assertSessionHas('state', $attempt['upstream_state']);
    expect(BrokerFixtureGoogleProvider::$lookups)->toBe(0);
    expect(brokerFixtureCallback($attempt)['params'])->toHaveKey('code');
});

test('handoff expires absolutely after sixty seconds', function () {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    $this->travel(60)->seconds();
    brokerFixtureExchange($grant)->assertUnauthorized();
    expect(PersonalAccessToken::count())->toBe(0);
});

test('stale callback preserves a newer native or web OAuth state', function (string $kind) {
    $old = brokerFixtureStart();
    if ($kind === 'native') {
        $current = brokerFixtureStart();
    } else {
        $this->get('/auth/google?redirect=/dashboard')->assertRedirect();
        $current = ['upstream_state' => session('state')];
    }
    $this->get('/auth/google/callback?'.http_build_query(['state' => $old['upstream_state'], 'code' => 'stale']))
        ->assertRedirect('/?error=auth_failed')->assertSessionHas('state', $current['upstream_state']);
    expect(BrokerFixtureGoogleProvider::$lookups)->toBe(0);
    if ($kind === 'native') {
        expect(brokerFixtureCallback($current)['params'])->toHaveKeys(['code', 'state']);
        expect(Auth::guard('web')->check())->toBeFalse();
    } else {
        $this->get('/auth/google/callback?'.http_build_query(['state' => $current['upstream_state'], 'code' => 'current']))->assertRedirect('/dashboard');
        expect(Auth::guard('web')->user()?->email)->toBe('broker@example.test');
    }
})->with(['native', 'web']);

test('native callback cannot replace an existing browser identity or its intended destination', function () {
    $browser = User::factory()->create();
    $this->actingAs($browser, 'web')->withSession(['url.intended' => '/dashboard?tab=submissions']);
    $grant = brokerFixtureCallback(brokerFixtureStart());
    expect(Auth::guard('web')->id())->toBe($browser->id)->and(session('url.intended'))->toBe('/dashboard?tab=submissions');
    $response = brokerFixtureExchange($grant)->assertOk();
    expect($response->json('user.id'))->not->toBe($browser->id)->and(Auth::guard('web')->id())->toBe($browser->id);
});

test('unverified or absent Google email never upserts on the native branch', function (mixed $verified) {
    BrokerFixtureGoogleProvider::$profile['email_verified'] = $verified;
    $grant = brokerFixtureCallback(brokerFixtureStart());
    expect($grant['params'])->toBe(['error' => 'unverified_email', 'state' => $grant['state']])
        ->and(User::count())->toBe(0)->and(PersonalAccessToken::count())->toBe(0)->and(Auth::guard('web')->check())->toBeFalse();
})->with([false, null, 'false', 1]);

test('missing malformed or unverified native Google profile fields never create an account', function (string $field) {
    if ($field === 'legacy_verified') {
        unset(BrokerFixtureGoogleProvider::$profile['email_verified']);
        BrokerFixtureGoogleProvider::$profile['verified_email'] = true;
    } elseif ($field === 'malformed_email') {
        BrokerFixtureGoogleProvider::$profile['email'] = 'not-an-email';
    } else {
        unset(BrokerFixtureGoogleProvider::$profile[$field]);
    }
    $grant = brokerFixtureCallback(brokerFixtureStart());
    expect($grant['params'])->not->toHaveKey('code')->and($grant['params']['state'])->toBe($grant['state'])
        ->and(User::count())->toBe(0)->and(PersonalAccessToken::count())->toBe(0);
})->with(['email', 'sub', 'legacy_verified', 'malformed_email']);

test('the native Google callback refuses a banned source account without a browser login', function () {
    User::factory()->create(['email' => 'broker@example.test', 'is_banned' => true]);
    $grant = brokerFixtureCallback(brokerFixtureStart());
    expect($grant['params'])->toBe(['error' => 'banned', 'state' => $grant['state']])
        ->and(Auth::guard('web')->check())->toBeFalse()->and(PersonalAccessToken::count())->toBe(0);
});

test('redemption refuses fresh ban deletion or provider changes without restoring or upserting', function (string $change) {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    $user = User::where('email', 'broker@example.test')->firstOrFail();
    match ($change) {
        'ban' => $user->update(['is_banned' => true]),
        'delete' => $user->delete(),
        'provider' => $user->update(['google_id' => 'changed-provider-sub']),
    };
    brokerFixtureExchange($grant)->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');
    expect(PersonalAccessToken::count())->toBe(0)->and(User::withTrashed()->count())->toBe(1);
    if ($change === 'delete') {
        expect($user->fresh()->trashed())->toBeTrue();
    }
})->with(['ban', 'delete', 'provider']);

test('redemption reads current capabilities rather than restoring privileged callback snapshots', function () {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    User::where('email', 'broker@example.test')->update(['role' => 'user', 'permissions' => json_encode(['transit.view_admin']), 'permission_scopes' => json_encode(['transit' => ['damascus']])]);
    brokerFixtureExchange($grant)->assertOk()->assertJsonPath('user.role', 'user')
        ->assertJsonPath('user.permissions', ['transit.view_admin'])->assertJsonPath('user.transit_scope', ['damascus']);
});

test('native handoffs use production-compatible shared database cache and atomic locks', function () {
    expect(Cache::store()->getStore())->toBeInstanceOf(DatabaseStore::class);
    $grant = brokerFixtureCallback(brokerFixtureStart());
    $key = 'native-google-handoff:'.hash('sha256', $grant['params']['code']);
    $lock = Cache::store()->getStore()->lock($key.':lock', 30);
    expect($lock->get())->toBeTrue();
    try {
        brokerFixtureExchange($grant)->assertServiceUnavailable();
        expect(PersonalAccessToken::count())->toBe(0);
    } finally {
        $lock->release();
    }
    brokerFixtureExchange($grant)->assertOk();
    expect(Cache::get($key))->toBeNull();
});

test('failed cache consumption cannot mint a token', function () {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    $key = 'native-google-handoff:'.hash('sha256', $grant['params']['code']);
    $cache = Mockery::mock(Repository::class, [Cache::store()->getStore()])->makePartial();
    $cache->shouldReceive('forget')->with($key)->once()->andReturn(false);
    app()->instance(NativeGoogleBroker::class, new NativeGoogleBroker($cache));
    brokerFixtureExchange($grant)->assertServiceUnavailable()->assertHeader('Cache-Control', 'no-store, private');
    expect(PersonalAccessToken::count())->toBe(0);
});

test('an expired lock and stale grant cannot mint twice while the first user transaction is in progress', function () {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    $key = 'native-google-handoff:'.hash('sha256', $grant['params']['code']);
    $stale = Cache::get($key);
    $issuer = new MobileSessionTokens;
    $interleaved = null;
    $entered = false;
    $mock = Mockery::mock(MobileSessionTokens::class);
    $mock->shouldReceive('issue')->andReturnUsing(function ($user, $deviceName) use (&$entered, &$interleaved, $issuer, $stale, $key, $grant) {
        if (! $entered) {
            $entered = true;
            // Stage an expired lease and a stale cache view at the actual
            // issuance boundary. Both contenders still use DatabaseStore.
            Cache::put($key, $stale, 60);
            Cache::store()->getStore()->lock($key.':lock', 30)->forceRelease();
            $interleaved = app(NativeGoogleBroker::class)->redeem($grant['params']['code'], $grant['verifier'], $grant['state'], 'Second local contender');
        }

        return $issuer->issue($user, $deviceName);
    });
    app()->instance(MobileSessionTokens::class, $mock);
    brokerFixtureExchange($grant)->assertOk();
    expect($entered)->toBeTrue()->and($interleaved)->toBeNull()->and(PersonalAccessToken::count())->toBe(1);
});

test('a successful-looking forget with a stale row does not prove consumption', function () {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    $key = 'native-google-handoff:'.hash('sha256', $grant['params']['code']);
    $cache = Mockery::mock(Repository::class, [Cache::store()->getStore()])->makePartial();
    $cache->shouldReceive('forget')->with($key)->andReturn(true);
    app()->instance(NativeGoogleBroker::class, new NativeGoogleBroker($cache));
    brokerFixtureExchange($grant)->assertOk();
    brokerFixtureExchange($grant)->assertUnauthorized();
    expect(PersonalAccessToken::count())->toBe(1);
});

test('a failed mint retains the consumed claim even when a stale grant returns', function () {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    $key = 'native-google-handoff:'.hash('sha256', $grant['params']['code']);
    $stale = Cache::get($key);
    $issuer = Mockery::mock(MobileSessionTokens::class);
    $issuer->shouldReceive('issue')->once()->andThrow(new RuntimeException('Local mint failure'));
    app()->instance(MobileSessionTokens::class, $issuer);
    brokerFixtureExchange($grant)->assertServiceUnavailable();
    expect(Cache::get($key.':consumed'))->toBeTrue()->and(PersonalAccessToken::count())->toBe(0);
    app()->forgetInstance(MobileSessionTokens::class);
    Cache::put($key, $stale, 60);
    brokerFixtureExchange($grant)->assertUnauthorized();
    expect(PersonalAccessToken::count())->toBe(0);
});

test('absolute code expiry is checked again after the fresh user row is acquired', function () {
    $grant = brokerFixtureCallback(brokerFixtureStart());
    Event::listen('eloquent.retrieved: '.User::class, function () {
        test()->travel(60)->seconds();
    });
    brokerFixtureExchange($grant)->assertUnauthorized();
    expect(PersonalAccessToken::count())->toBe(0);
});

test('process-local cache cannot start or redeem a native Google grant', function () {
    app()->instance(NativeGoogleBroker::class, new NativeGoogleBroker(Cache::store('array')));
    $verifier = brokerBase64(random_bytes(32));
    $this->get(GOOGLE_NATIVE_START.'?'.http_build_query(['code_challenge' => brokerBase64(hash('sha256', $verifier, true)), 'code_challenge_method' => 'S256', 'state' => str_repeat('a', 64)]))
        ->assertServiceUnavailable()->assertHeader('Cache-Control', 'no-store, private');
    $this->postJson(GOOGLE_NATIVE_EXCHANGE, ['code' => brokerBase64(random_bytes(32)), 'code_verifier' => $verifier, 'state' => str_repeat('a', 64)])
        ->assertServiceUnavailable()->assertHeader('Cache-Control', 'no-store, private');
    expect(BrokerFixtureGoogleProvider::$lookups)->toBe(0)->and(PersonalAccessToken::count())->toBe(0);
});

test('native token shape and lockout errors are bounded and never cacheable', function () {
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $this->postJson(GOOGLE_NATIVE_EXCHANGE, [])->assertUnprocessable()->assertHeader('Cache-Control', 'no-store, private');
    }
    $response = $this->postJson(GOOGLE_NATIVE_EXCHANGE, [])->assertStatus(429)->assertHeader('Cache-Control', 'no-store, private');
    expect((int) $response->headers->get('Retry-After'))->toBeGreaterThan(0)->and(PersonalAccessToken::count())->toBe(0);
});

test('native exchange succeeds with real CSRF enforcement but browser origins still require CSRF', function () {
    app()->bind(ValidateCsrfToken::class, BrokerEnforcedCsrf::class);
    app()->bind(PreventRequestForgery::class, BrokerEnforcedCsrf::class);
    config(['sanctum.stateful' => ['localhost']]);
    $grant = brokerFixtureCallback(brokerFixtureStart());
    brokerFixtureExchange($grant)->assertOk();
    $grant = brokerFixtureCallback(brokerFixtureStart());
    $this->withHeader('Origin', 'http://localhost');
    brokerFixtureExchange($grant)->assertStatus(419);
    expect(PersonalAccessToken::count())->toBe(1);
});

test('native exchange is an API action and keeps the existing mobile Google aliases untouched', function () {
    $route = Route::getRoutes()->match(Request::create(GOOGLE_NATIVE_EXCHANGE, 'POST'));
    expect($route->gatherMiddleware())->toContain('api', 'throttle:native-google-exchange')->not->toContain('web', 'auth:sanctum');
    expect(Route::getRoutes()->match(Request::create('/api/v1/auth/google/token', 'POST'))->getActionMethod())->toBe('googleToken')
        ->and(Route::getRoutes()->match(Request::create('/api/v1/auth/google', 'POST'))->getActionMethod())->toBe('googleToken');
});
