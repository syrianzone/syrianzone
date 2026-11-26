<?php

namespace App\Providers;

use App\Models\City;
use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Models\HouseMember2026;
use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\Poll;
use App\Models\Promise;
use App\Models\PromiseSector;
use App\Models\PromiseSpeaker;
use App\Models\PromiseUpdate;
use App\Models\Route as TransitRoute;
use App\Observers\IndexNow\CityObserver;
use App\Observers\IndexNow\GovAppObserver;
use App\Observers\IndexNow\GovtOfficialObserver;
use App\Observers\IndexNow\GovtTenureObserver;
use App\Observers\IndexNow\PlaceObserver;
use App\Observers\IndexNow\PlacePhotoObserver;
use App\Observers\IndexNow\PollObserver;
use App\Observers\IndexNow\PromiseObserver;
use App\Observers\IndexNow\TransitRouteObserver;
use App\Services\Promises\PromiseIndexCache;
use App\Support\Agents\AgentAuthorizer;
use App\Support\Agents\AgentContext;
use App\Support\Agents\TokenAbilities;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;

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

        // Share cards are drawn by the Node renderer; tests swap in a fake.
        $this->app->bind(\App\Support\Seo\Og\CardRenderer::class, \App\Support\Seo\Og\NodeCardRenderer::class);
    }

    public function boot(): void
    {
        // Per-page SEO and share-preview metadata for the root view, which
        // prints it on every response so crawlers and link-preview scrapers
        // never depend on JavaScript or on SSR. See docs/guidelines/seo.md.
        View::composer('app', function ($view) {
            $view->with('meta', \App\Support\Seo\SeoMeta::resolve(request()));
        });

        // Which tokens may authenticate which requests: a banned owner's token
        // nowhere, an agent token only on the MCP endpoint. See TokenAbilities.
        Sanctum::authenticateAccessTokensUsing(
            fn (PersonalAccessToken $token, bool $isValid): bool => $isValid && TokenAbilities::authenticates($token, request())
        );

        // Any write to the tracker drops the cached /promises payload.
        foreach ([Promise::class, PromiseUpdate::class, PromiseSpeaker::class, PromiseSector::class] as $model) {
            $model::saved(fn () => PromiseIndexCache::flush());
            $model::deleted(fn () => PromiseIndexCache::flush());
        }

        // The cached /house roster follows edits made through the model.
        HouseMember2026::saved(fn () => HouseMember2026::forgetRosterCache());
        HouseMember2026::deleted(fn () => HouseMember2026::forgetRosterCache());

        // Queue public URLs for IndexNow on publish, update, or removal.
        Promise::observe(PromiseObserver::class);
        GovtOfficial::observe(GovtOfficialObserver::class);
        GovtTenure::observe(GovtTenureObserver::class);
        GovApp::observe(GovAppObserver::class);
        Poll::observe(PollObserver::class);
        City::observe(CityObserver::class);
        TransitRoute::observe(TransitRouteObserver::class);
        Place::observe(PlaceObserver::class);
        PlacePhoto::observe(PlacePhotoObserver::class);

        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }

        RateLimiter::for('voting', fn (Request $request) => Limit::perMinute(10)->by($request->ip())
            ->response($this->throttled('لقد وصلت إلى حد التصويت المسموح. يرجى المحاولة بعد قليل.')));

        // "Will it be kept?" votes can be cast straight from the /promises
        // cards, so one visitor may answer many in a row; the tier-list limit
        // (10/min per IP) would cut off honest voters behind a shared address.
        // Signed-in voters are counted per account, guests per IP.
        RateLimiter::for('promise-voting', function (Request $request) {
            $limit = $request->user()
                ? Limit::perMinute(60)->by('user:'.$request->user()->id)
                : Limit::perMinute(30)->by('ip:'.$request->ip());

            return $limit->response($this->throttled('صوّتَ كثيراً في وقت قصير، انتظر دقيقة ثم حاول مجدداً'));
        });

        RateLimiter::for('public-api', fn (Request $request) => Limit::perMinute(60)->by($request->ip())
            ->response($this->throttled('تم تجاوز حد الطلبات المسموح. يرجى المحاولة بعد قليل.')));

        RateLimiter::for('compass-stats', function (Request $request) {
            $response = $this->throttled('يمكنك إرسال نتيجة مجهولة واحدة كل عشر دقائق.');

            // Anonymous (guest) submissions: one per 10 minutes per IP.
            // Logged-in users: a bit more headroom, still capped.
            if ($request->user()) {
                return Limit::perMinutes(10, 5)->by('user:'.$request->user()->id)
                    ->response($response);
            }

            return Limit::perMinutes(10, 1)->by('ip:'.$request->ip())
                ->response($response);
        });

        RateLimiter::for('studio-submit', function (Request $request) {
            $response = $this->throttled('تم تجاوز حد المحاولات المسموح، يرجى الانتظار قليلاً قبل إعادة المحاولة.');

            if ($request->user()) {
                return Limit::perMinute(30)->by('user:'.$request->user()->id)
                    ->response($response);
            }

            return Limit::perMinute(5)->by('ip:'.$request->ip())
                ->response($response);
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

            return Limit::perMinute(120)->by($key)
                ->response($this->throttled('تم تجاوز حد طلبات الوكيل. يرجى الانتظار قليلاً ثم إعادة المحاولة.'));
        });
    }

    /**
     * The legacy `{message, error}` 429 envelope, produced in one place.
     *
     * The shape is a released contract (mobile clients read `message`, older
     * web callers read `error`), so both keys carry the same text.
     *
     * The framework passes the rate-limit headers to this callback and attaches
     * only what the response carries; `Lib/api.ts` reads `Retry-After` to tell
     * the visitor how long to wait, so dropping them left the busiest limiters
     * with no wait time in the body either.
     */
    private function throttled(string $message): \Closure
    {
        return fn ($request, array $headers) => response()->json([
            'message' => $message,
            'error' => $message,
        ], 429, $headers);
    }
}
