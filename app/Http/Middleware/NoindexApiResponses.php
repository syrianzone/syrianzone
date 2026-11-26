<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Marks JSON answered under /api as not for search results.
 *
 * Crawlers that render pages discover the /api URLs the browser bundle calls
 * and fetch them. robots.txt must not block them, because a rendering crawler
 * needs those responses to see the page as a visitor does, so the response
 * itself says `noindex` instead. Only JSON is marked: an image an endpoint
 * serves (an app icon) may still appear in image search.
 *
 * Covers both route files: some /api paths are registered in routes/web.php.
 * See docs/guidelines/seo.md.
 */
class NoindexApiResponses
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (
            ($request->is('api') || $request->is('api/*'))
            && ! $response->headers->has('X-Robots-Tag')
            && str_contains((string) $response->headers->get('Content-Type'), 'json')
        ) {
            $response->headers->set('X-Robots-Tag', 'noindex');
        }

        return $response;
    }
}
