<?php

namespace App\Services\Auth;

use App\Models\User;
use DanHarrin\LivewireRateLimiting\WithRateLimiting;
use Filament\Auth\Pages\Login;
use Filament\Facades\Filament;
use Filament\Panel;
use Illuminate\Auth\Events\Attempting;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Validated;
use Illuminate\Auth\SessionGuard;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Timebox;

class SuperadminPasswordLogin
{
    use WithRateLimiting;

    public function consumeAttempt(): void
    {
        // The website's default Filament Login owns this exact IP budget.
        $this->rateLimit(5, 60, 'authenticate', Login::class);
    }

    /**
     * @param  array{email: string, password: string}  $credentials
     * @return array<string, mixed>|null
     */
    public function attempt(#[\SensitiveParameter] array $credentials, ?string $deviceName): ?array
    {
        $panel = Filament::getPanel('superadmin');
        /** @var SessionGuard $guard */
        $guard = Auth::guard($panel->getAuthGuard());
        $provider = $guard->getProvider();

        return app(Timebox::class)->dontReturnEarly()->call(function (Timebox $timebox) use ($panel, $guard, $provider, $credentials, $deviceName): ?array {
            event(new Attempting($guard->name, $credentials, false));
            $candidate = $provider->retrieveByCredentials($credentials);

            if (! ($candidate instanceof User)) {
                event(new Failed($guard->name, $candidate, $credentials));

                return null;
            }

            return DB::transaction(function () use ($candidate, $panel, $guard, $provider, $credentials, $deviceName, $timebox): ?array {
                // Read password, panel eligibility and token ownership from one
                // locked row, including concurrent demotion, ban or deletion.
                $user = User::query()->whereKey($candidate->getKey())
                    ->where('email', $credentials['email'])->lockForUpdate()->first();

                if (! $user || ! $provider->validateCredentials($user, $credentials) || ! $user->canAccessPanel($panel) || $this->needsMultiFactorChallenge($panel, $user)) {
                    event(new Failed($guard->name, $user, $credentials));

                    return null;
                }

                event(new Validated($guard->name, $user));

                if (config('hashing.rehash_on_login', true)) {
                    $provider->rehashPasswordIfRequired($user, $credentials);
                }

                $session = app(MobileSessionTokens::class)->issue($user, $deviceName);
                $timebox->returnEarly();

                return $session;
            });
        }, (int) config('auth.timebox_duration', 200_000));
    }

    private function needsMultiFactorChallenge(Panel $panel, User $user): bool
    {
        // Never turn a future panel MFA requirement into password-only access.
        if ($panel->isMultiFactorAuthenticationRequired()) {
            return true;
        }

        foreach ($panel->getMultiFactorAuthenticationProviders() as $provider) {
            if ($provider->isEnabled($user)) {
                return true;
            }
        }

        return false;
    }
}
