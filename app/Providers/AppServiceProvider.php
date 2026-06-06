<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        if (config('app.env') === 'production') {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        }

        RateLimiter::for('voting', fn(Request $request) =>
            Limit::perMinute(10)->by($request->ip())->response(fn() =>
                response()->json(['error' => 'Too many votes. Please slow down.'], 429)
            )
        );

        \Illuminate\Support\Facades\Broadcast::resolveRequestUsing(function ($request) {
            if ($user = $request->user()) {
                return $user;
            }

            // Return a GenericUser dummy object for unauthenticated guest connections
            $sessionId = $request->header('X-Guess-Who-Session-ID')
                ?? $request->input('session_id') 
                ?? 'guest-' . \Illuminate\Support\Str::uuid();

            return new \Illuminate\Auth\GenericUser([
                'id' => $sessionId,
                'name' => 'لاعب ضيف',
            ]);
        });
    }
}
