<?php

use App\Models\User;
use App\Support\Agents\TokenAbilities;
use Filament\Auth\MultiFactor\Contracts\MultiFactorAuthenticationProvider;
use Filament\Auth\Pages\Login;
use Filament\Facades\Filament;
use Illuminate\Auth\Events\Attempting;
use Illuminate\Auth\Events\Failed;
use Illuminate\Contracts\Auth\UserProvider;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Sleep;
use Laravel\Sanctum\PersonalAccessToken;

const NATIVE_ADMIN_LOGIN = '/api/v1/auth/superadmin/token';
const ADMIN_LOGIN_FAILURE = 'بيانات تسجيل الدخول غير صحيحة أو لا يمكن لهذا الحساب دخول لوحة الإدارة.';

class NativePasswordEnforcedCsrf extends ValidateCsrfToken
{
    protected function runningUnitTests()
    {
        return false;
    }
}

function filamentPasswordBudget(): string
{
    return 'livewire-rate-limiter:'.sha1(Login::class.'|authenticate|127.0.0.1');
}

beforeEach(function () {
    Sleep::fake();
    Http::preventStrayRequests();
    RateLimiter::clear(filamentPasswordBudget());
});

afterEach(function () {
    RateLimiter::clear(filamentPasswordBudget());
    Sleep::fake(false);
});

test('native administrator password login mints only the existing mobile session and never starts a web session', function () {
    $admin = User::factory()->superadmin()->create(['password' => Hash::make('local-password'), 'google_id' => 'private-fixture']);
    $response = $this->postJson(NATIVE_ADMIN_LOGIN, [
        'email' => $admin->email, 'password' => 'local-password', 'device_name' => ' iPhone local ',
        'abilities' => ['*'], 'permissions' => ['*'], 'role' => 'user',
    ])->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('token_type', 'Bearer')->assertJsonPath('expires_at', null)
        ->assertJsonPath('user.id', $admin->id)->assertJsonPath('user.role', 'superadmin')
        ->assertJsonMissingPath('user.password')->assertJsonMissingPath('user.google_id')->assertJsonMissingPath('user.remember_token');
    $token = PersonalAccessToken::findToken($response->json('token'));
    expect($token)->not->toBeNull()->and($token->abilities)->toBe([TokenAbilities::MOBILE])
        ->and($token->name)->toBe('iPhone local')->and($token->tokenable_id)->toBe($admin->id)
        ->and(Auth::guard('web')->check())->toBeFalse()
        ->and($response->headers->getCookies())->toBeEmpty()
        ->and($response->getContent())->not->toContain('local-password', 'private-fixture');
    $response->assertCookieMissing(config('session.cookie'));
    $route = Route::getRoutes()->match(Request::create(NATIVE_ADMIN_LOGIN, 'POST'));
    expect($route->gatherMiddleware())->toContain('api')->not->toContain('web', 'auth:sanctum');
});

test('unknown wrong password ordinary wildcard banned and deleted accounts have the same generic credential failure', function (string $kind) {
    $admin = $kind === 'unknown' ? null : User::factory()->create([
        'role' => in_array($kind, ['ordinary', 'wildcard'], true) ? 'user' : 'superadmin',
        'permissions' => $kind === 'wildcard' ? ['*'] : [], 'is_banned' => $kind === 'banned',
        'password' => Hash::make('local-password'),
    ]);
    if ($kind === 'deleted') {
        $admin->delete();
    }
    $before = User::withTrashed()->count();
    $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin?->email ?? 'unknown@example.test', 'password' => $kind === 'wrong' ? 'wrong' : 'local-password'])
        ->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private')
        ->assertExactJson(['message' => ADMIN_LOGIN_FAILURE, 'errors' => ['email' => [ADMIN_LOGIN_FAILURE]]]);
    expect(PersonalAccessToken::count())->toBe(0)->and(User::withTrashed()->count())->toBe($before);
    if ($kind === 'deleted') {
        expect($admin->fresh()->trashed())->toBeTrue();
    }
    Sleep::assertSleptTimes(1);
})->with(['unknown', 'wrong', 'ordinary', 'wildcard', 'banned', 'deleted']);

test('an existing bearer or web identity cannot substitute for the submitted administrator password', function () {
    $admin = User::factory()->superadmin()->create(['password' => Hash::make('local-password')]);
    $this->withHeader('Authorization', 'Bearer '.$admin->createToken('Existing', ['mobile'])->plainTextToken)
        ->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'wrong'])->assertUnauthorized();
    expect($admin->tokens()->count())->toBe(1);
    $this->actingAs($admin, 'web')->postJson(NATIVE_ADMIN_LOGIN, [])->assertUnprocessable()->assertHeader('Cache-Control', 'no-store, private');
    expect($admin->tokens()->count())->toBe(1);
});

test('password authentication shares Filament lockout and successful login does not reset that budget', function () {
    expect(Filament::getPanel('superadmin')->getLoginRouteAction())->toBe(Login::class);
    $admin = User::factory()->superadmin()->create(['password' => Hash::make('local-password')]);
    $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'wrong'])->assertUnauthorized();
    $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'local-password'])->assertOk();
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'wrong'])->assertUnauthorized();
    }
    expect(RateLimiter::attempts(filamentPasswordBudget()))->toBe(5);
    $blocked = $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'local-password'])
        ->assertStatus(429)->assertHeader('Cache-Control', 'no-store, private')->assertJsonStructure(['message', 'retry_after']);
    expect((int) $blocked->headers->get('Retry-After'))->toBeGreaterThan(0)
        ->and($blocked->json('retry_after'))->toBe((int) $blocked->headers->get('Retry-After'));
    expect(app(Login::class)->authenticate())->toBeNull();
    $this->travel(61)->seconds();
    $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'local-password'])->assertOk();
    expect($admin->tokens()->count())->toBe(2);
});

test('existing Filament attempts and invalid form submissions consume the native login budget', function () {
    for ($attempt = 0; $attempt < 5; $attempt++) {
        RateLimiter::hit(filamentPasswordBudget(), 60);
    }
    $this->postJson(NATIVE_ADMIN_LOGIN, [])->assertStatus(429);
    RateLimiter::clear(filamentPasswordBudget());
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->postJson(NATIVE_ADMIN_LOGIN, [])->assertUnprocessable();
    }
    $this->postJson(NATIVE_ADMIN_LOGIN, [])->assertStatus(429);
});

test('fresh locked credentials and eligibility prevent a changed account from issuing a native token', function (string $change) {
    $admin = User::factory()->superadmin()->create(['password' => Hash::make('local-password')]);
    $guard = Auth::guard('web');
    $provider = $guard->getProvider();
    $staleProvider = Mockery::mock(UserProvider::class);
    $staleProvider->shouldReceive('retrieveByCredentials')->once()->andReturnUsing(function () use ($admin, $change) {
        $stale = $admin->fresh();
        if ($change === 'delete') {
            $admin->delete();
        } else {
            User::whereKey($admin->id)->update(match ($change) {
                'role' => ['role' => 'user'],
                'ban' => ['is_banned' => true],
                'email' => ['email' => 'changed@example.test'],
                'password' => ['password' => Hash::make('changed-password')],
            });
        }

        return $stale;
    });
    $staleProvider->shouldReceive('validateCredentials')->andReturnUsing(fn ($user, $credentials) => $provider->validateCredentials($user, $credentials));
    $staleProvider->shouldReceive('rehashPasswordIfRequired')->andReturnUsing(fn ($user, $credentials) => $provider->rehashPasswordIfRequired($user, $credentials));
    $guard->setProvider($staleProvider);
    $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'local-password'])->assertUnauthorized();
    expect($admin->tokens()->count())->toBe(0);
})->with(['role', 'ban', 'delete', 'password', 'email']);

test('native password login rehashes only verified eligible credentials using the configured provider policy', function () {
    config(['hashing.bcrypt.rounds' => 6, 'hashing.rehash_on_login' => true]);
    Hash::forgetDrivers();
    $old = Hash::make('local-password', ['rounds' => 4]);
    $admin = User::factory()->superadmin()->create(['password' => $old]);
    expect(Hash::needsRehash($old))->toBeTrue();
    $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'local-password'])->assertOk();
    expect(Hash::check('local-password', $admin->fresh()->password))->toBeTrue()
        ->and(Hash::needsRehash($admin->fresh()->password))->toBeFalse();
});

test('the configured password rehash opt-out is preserved by native login', function () {
    config(['hashing.bcrypt.rounds' => 6, 'hashing.rehash_on_login' => false]);
    Hash::forgetDrivers();
    $old = Hash::make('local-password', ['rounds' => 4]);
    $admin = User::factory()->superadmin()->create(['password' => $old]);
    $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'local-password'])->assertOk();
    expect($admin->fresh()->password)->toBe($old);
});

test('native credentials work with real CSRF enforcement while browser-origin requests still require CSRF', function () {
    app()->bind(ValidateCsrfToken::class, NativePasswordEnforcedCsrf::class);
    app()->bind(PreventRequestForgery::class, NativePasswordEnforcedCsrf::class);
    config(['sanctum.stateful' => ['localhost']]);
    $admin = User::factory()->superadmin()->create(['password' => Hash::make('local-password')]);
    $credentials = ['email' => $admin->email, 'password' => 'local-password'];
    $this->postJson(NATIVE_ADMIN_LOGIN, $credentials)->assertOk();
    $this->withHeader('Origin', 'http://localhost')->postJson(NATIVE_ADMIN_LOGIN, $credentials)->assertStatus(419);
    expect($admin->tokens()->count())->toBe(1);
});

test('native login cannot bypass an enabled or required Filament multi-factor challenge', function (bool $required) {
    Mail::fake();
    Notification::fake();
    $provider = Mockery::mock(MultiFactorAuthenticationProvider::class);
    $provider->shouldReceive('getId')->andReturn('fixture');
    $provider->shouldReceive('isEnabled')->andReturn(true);
    Filament::getPanel('superadmin')->multiFactorAuthentication($required ? [] : [$provider], isRequired: $required);
    $admin = User::factory()->superadmin()->create(['password' => Hash::make('local-password')]);
    $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'local-password'])
        ->assertUnauthorized()->assertExactJson(['message' => ADMIN_LOGIN_FAILURE, 'errors' => ['email' => [ADMIN_LOGIN_FAILURE]]]);
    expect($admin->tokens()->count())->toBe(0);
    Mail::assertNothingSent();
    Notification::assertNothingSent();
})->with([false, true]);

test('password mobile sessions obey current-device all-device ban and agent-token policies', function () {
    $admin = User::factory()->superadmin()->create(['password' => Hash::make('local-password')]);
    $first = $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'local-password'])->assertOk()->json('token');
    $second = $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'local-password'])->assertOk()->json('token');
    $agent = $admin->createToken('Agent fixture', ['users.ban'])->accessToken;
    Auth::forgetGuards();
    $this->withHeader('Authorization', 'Bearer '.$first)->getJson('/api/v1/admin/users/options')->assertOk();
    $this->postJson('/mcp/admin', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'])->assertForbidden();
    $this->postJson('/api/v1/auth/logout')->assertOk();
    expect(PersonalAccessToken::findToken($first))->toBeNull();
    Auth::forgetGuards();
    $admin->update(['is_banned' => true]);
    $this->withHeader('Authorization', 'Bearer '.$second)->getJson('/api/v1/admin/users/options')->assertForbidden();
    Auth::forgetGuards();
    $admin->update(['is_banned' => false]);
    $this->postJson('/api/v1/auth/logout-devices')->assertOk();
    expect(PersonalAccessToken::findToken($second))->toBeNull()->and($agent->fresh())->not->toBeNull();
});

test('denied native credentials emit source authentication events without exposing their details', function () {
    Event::fake([Attempting::class, Failed::class]);
    $admin = User::factory()->superadmin()->create(['password' => Hash::make('local-password')]);
    $this->postJson(NATIVE_ADMIN_LOGIN, ['email' => $admin->email, 'password' => 'wrong'])->assertUnauthorized();
    Event::assertDispatched(Attempting::class);
    Event::assertDispatched(Failed::class);
});
