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

        RateLimiter::for('public-api', fn(Request $request) =>
            Limit::perMinute(60)->by($request->ip())->response(fn() =>
                response()->json(['error' => 'Too many requests. Please slow down.'], 429)
            )
        );

        RateLimiter::for('studio-submit', function (Request $request) {
            $message = ['message' => 'تم تجاوز حد المحاولات المسموح، يرجى الانتظار قليلاً قبل إعادة المحاولة.'];

            if ($request->user()) {
                return Limit::perMinute(30)->by('user:' . $request->user()->id)
                    ->response(fn($request, $headers) => response()->json($message, 429, $headers));
            }

            return Limit::perMinute(5)->by('ip:' . $request->ip())
                ->response(fn($request, $headers) => response()->json($message, 429, $headers));
        });

        \Illuminate\Support\Facades\Gate::before(function ($user, $ability) {
            if ($user->isSuperAdmin()) {
                return true;
            }
        });

    }
}
