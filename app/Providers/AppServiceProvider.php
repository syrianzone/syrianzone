<?php

namespace App\Providers;

use App\Support\Agents\AgentAuthorizer;
use App\Support\Agents\AgentContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\PersonalAccessToken;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // One authorizer for the whole agent surface, resolved per request. The
        // concrete AgentContext is bound by RequireApiToken middleware once a
        // real bearer token is confirmed; until then an anonymous context is
        // used, which denies every permission check.
        $this->app->singleton(AgentAuthorizer::class);

        $this->app->bind(AgentContext::class, fn () => AgentContext::anonymous());
    }

    public function boot(): void
    {
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }

        RateLimiter::for('voting', fn (Request $request) => Limit::perMinute(10)->by($request->ip())->response(fn () => response()->json(['error' => 'Too many votes. Please slow down.'], 429)
        )
        );

        RateLimiter::for('public-api', fn (Request $request) => Limit::perMinute(60)->by($request->ip())->response(fn () => response()->json(['error' => 'Too many requests. Please slow down.'], 429)
        )
        );

        RateLimiter::for('studio-submit', function (Request $request) {
            $message = ['message' => 'تم تجاوز حد المحاولات المسموح، يرجى الانتظار قليلاً قبل إعادة المحاولة.'];

            if ($request->user()) {
                return Limit::perMinute(30)->by('user:'.$request->user()->id)
                    ->response(fn ($request, $headers) => response()->json($message, 429, $headers));
            }

            return Limit::perMinute(5)->by('ip:'.$request->ip())
                ->response(fn ($request, $headers) => response()->json($message, 429, $headers));
        });

        // Agent/MCP traffic. Keyed by API token so one runaway agent cannot
        // exhaust the budget of another token that happens to share an egress
        // IP; falls back to the user id, then the IP for unauthenticated hits
        // that still need a throttle slot.
        RateLimiter::for('mcp', function (Request $request) {
            $tokenKey = $request->user()?->currentAccessToken();

            $key = $tokenKey instanceof PersonalAccessToken
                ? 'token:'.$tokenKey->getKey()
                : 'user:'.($request->user()?->getAuthIdentifier() ?? 'ip:'.$request->ip());

            return Limit::perMinute(120)->by($key)->response(fn () => response()->json([
                'error' => 'Too many agent requests. Slow down and retry shortly.',
            ], 429));
        });

        Gate::before(function ($user, $ability) {
            if ($user->isSuperAdmin()) {
                return true;
            }
        });

    }
}
