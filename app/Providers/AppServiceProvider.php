<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->loadRoutesFrom(base_path('routes/mobile-auth.php'));

        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }

        RateLimiter::for('voting', function (Request $request) {
            return Limit::perMinute(10)
                ->by($request->ip())
                ->response(fn () => response()->json([
                    'error' => 'Too many votes. Please slow down.',
                ], 429));
        });

        RateLimiter::for('mobile-auth-start', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        RateLimiter::for('mobile-auth-callback', function (Request $request) {
            return Limit::perMinute(30)->by($request->ip());
        });

        RateLimiter::for('mobile-auth-exchange', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        RateLimiter::for('guess-who-signal', function (Request $request) {
            $credential = (string) $request->header('X-Guess-Who-Session-ID');
            $identity = $credential !== ''
              ? hash('sha256', $credential)
              : $request->ip();

            return Limit::perMinute(360)->by($identity);
        });
    }
}
