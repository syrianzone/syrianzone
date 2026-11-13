<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sends the Content-Security-Policy in report-only mode plus Permissions-Policy.
 *
 * Report-only is deliberate: the policy collects violations without blocking
 * anything, so it can be tightened and only then promoted to an enforcing
 * `Content-Security-Policy` header.
 *
 * HSTS, X-Content-Type-Options, Referrer-Policy and X-Frame-Options are not set
 * here: the production edge already sends them.
 */
class SecurityHeaders
{
    /**
     * Browser features this app actually uses are allowed for `self`; features
     * nothing calls are switched off. Unlisted features stay at the browser
     * default rather than being guessed at (see the audit in the PR that added
     * this middleware): geolocation drives the transit/board maps and the
     * prayer-time location, clipboard-write copies colour values.
     *
     * `web-share` and `bluetooth` are deliberately absent: Chrome does not
     * recognise either token and logs "Unrecognized feature" on every page.
     */
    private const PERMISSIONS_POLICY = 'geolocation=(self), clipboard-write=(self), '
        .'camera=(), microphone=(), payment=(), usb=(), serial=(), midi=(), '
        .'display-capture=(), magnetometer=(), gyroscope=(), accelerometer=()';

    public function handle(Request $request, Closure $next): Response
    {
        // Generated before rendering so @vite / @viteReactRefresh stamp it onto
        // the tags they emit; the same value goes into the CSP header below.
        // Every page load gets a fresh one.
        $this->beginResponse();

        return $this->applyHeaders($next($request));
    }

    /**
     * Start a response's nonce.
     *
     * The one place a nonce is created: `handle()` calls it before the response
     * renders, and the 404 renderer calls it because that page is built after
     * the middleware stack has unwound. Both then apply the same headers through
     * `applyHeaders()`.
     */
    public function beginResponse(): void
    {
        Vite::useCspNonce(base64_encode(random_bytes(16)));
    }

    /**
     * Adds the security headers to a rendered HTML response.
     */
    public function applyHeaders(Response $response): Response
    {
        // Only HTML documents: Inertia XHR payloads are JSON, and streamed or
        // binary responses (downloads, share cards, sitemap) must be left alone.
        if (! $this->isHtmlDocument($response)) {
            return $response;
        }

        // Someone else already owns the policy on this response; do not fight it.
        if ($response->headers->has('Content-Security-Policy')
            || $response->headers->has('Content-Security-Policy-Report-Only')) {
            return $response;
        }

        if (config('security.csp_report_only', true)) {
            $response->headers->set('Content-Security-Policy-Report-Only', $this->policy($this->registerNonce()));
        }

        $response->headers->set('Permissions-Policy', self::PERMISSIONS_POLICY);

        return $response;
    }

    /**
     * The nonce for this request, registering one only if nothing has yet.
     *
     * `applyHeaders()` uses it so the header and the tags agree even on a path
     * that rendered without `beginResponse()` first.
     */
    private function registerNonce(): string
    {
        $nonce = Vite::cspNonce();

        if (! is_string($nonce) || $nonce === '') {
            $nonce = base64_encode(random_bytes(16));

            Vite::useCspNonce($nonce);
        }

        return $nonce;
    }

    /**
     * `https:` and `'unsafe-inline'` are the guide's backwards-compatibility
     * ladder: browsers that understand the nonce and `'strict-dynamic'` ignore
     * them, old ones fall back to scheme, ancient ones to inline.
     */
    private function policy(string $nonce): string
    {
        $directives = [
            "script-src 'nonce-{$nonce}' 'strict-dynamic' 'report-sample' https: 'unsafe-inline'",
            "object-src 'none'",
            "base-uri 'none'",
            "frame-ancestors 'self'",
        ];

        $reportUri = config('security.csp_report_uri');

        if (is_string($reportUri) && $reportUri !== '') {
            $directives[] = 'report-uri '.$reportUri;
        }

        return implode('; ', $directives).';';
    }

    private function isHtmlDocument(Response $response): bool
    {
        $contentType = $response->headers->get('Content-Type', '');

        return is_string($contentType) && str_contains(strtolower($contentType), 'text/html');
    }
}
