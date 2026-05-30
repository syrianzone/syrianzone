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
        RateLimiter::for('voting', fn(Request $request) =>
            Limit::perMinute(10)->by($request->ip())->response(fn() =>
                response()->json(['error' => 'Too many votes. Please slow down.'], 429)
            )
        );
    }
}
