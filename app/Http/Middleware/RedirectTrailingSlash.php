<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * Permanently redirects GET/HEAD requests with a trailing slash (other than `/`)
 * to the slash-less path, preserving the query string.
 *
 * Production serves behind Caddy → Nginx (`serversideup/php:8.4-fpm-nginx`),
 * where `try_files $uri $uri/ /index.php?$query_string` redirects bare real
 * directory paths like `/syid-assets` to `/syid-assets/` (and 403s them).
 * Skipping real `public/` directories that have no matching Laravel route
 * prevents a redirect loop, while directories that do have a route (like
 * `/tierlist`, which Nginx explicitly passes to PHP) still canonicalize.
 */
class RedirectTrailingSlash
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->getMethod(), ['GET', 'HEAD'], true)) {
            return $next($request);
        }

        $path = $request->getPathInfo();
        if ($path === '/' || ! str_ends_with($path, '/')) {
            return $next($request);
        }

        // Strip all trailing slashes and any leading slashes/backslashes so
        // protocol-relative paths like `//evil.com/` collapse to `/evil.com`
        // rather than `//evil.com` (an open redirect).
        $trimmed = ltrim(rtrim($path, '/'), '/\\');
        $target = '/'.$trimmed;

        if ($trimmed !== '' && $this->isStaticPublicDirectory($trimmed, $target, $request->getMethod())) {
            return $next($request);
        }

        $query = $request->server->get('QUERY_STRING');
        if (! is_string($query) || $query === '') {
            $query = $request->getQueryString();
        }

        if (is_string($query) && $query !== '') {
            $target .= '?'.$query;
        }

        return new RedirectResponse($target, 301);
    }

    private function isStaticPublicDirectory(string $trimmed, string $target, string $method): bool
    {
        $decoded = rawurldecode($trimmed);
        if (str_contains($decoded, '..') || str_contains($decoded, "\0")) {
            return false;
        }

        if (! is_dir(public_path($decoded))) {
            return false;
        }

        try {
            Route::getRoutes()->match(Request::create($target, $method));

            return false;
        } catch (HttpExceptionInterface) {
            return true;
        }
    }
}
