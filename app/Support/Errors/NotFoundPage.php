<?php

namespace App\Support\Errors;

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use App\Services\Transit\TransitCities;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * The `Errors/NotFound` page for a GET HTML 404.
 *
 * A 404 is raised after the web middleware group has unwound, so the exception
 * handler cannot simply let the response through: the two things the group does
 * around a normal render are replayed here through their owners — the shared
 * props through `HandleInertiaRequests::share()`, the CSP nonce and its headers
 * through `SecurityHeaders`. A new shared prop or a new security header reaches
 * this page without an edit here.
 *
 * The page picks its own variant from the path (`detectSectionFromPath` in
 * `Pages/Errors/NotFound.tsx`), so the server sends no section and cannot
 * disagree with the client about which 404 a visitor sees.
 */
final class NotFoundPage
{
    /**
     * Whether this response is a 404 the page should replace. Gated, kept,
     * ephemeral and JSON responses are left alone: only a real navigation gets
     * the Inertia page.
     */
    public static function replaces(Request $request, Response $response): bool
    {
        return $response->getStatusCode() === 404
            && $request->isMethod('GET')
            && ! $request->expectsJson()
            && ! $request->is('api/*', 'superadmin*');
    }

    public static function render(Request $request): Response
    {
        SeoMeta::override($request, [
            'title' => 'الصفحة غير موجودة (404) | Syrian Zone',
            'description' => 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها — استكشف أدوات ومشاريع المساحة السورية.',
            'robots' => 'noindex, follow',
        ]);

        Inertia::share(app(HandleInertiaRequests::class)->share($request));

        // The nonce must exist while the view stamps its script tags, which is
        // before the response exists to carry the header.
        $securityHeaders = app(SecurityHeaders::class);
        $securityHeaders->beginResponse();

        return $securityHeaders->applyHeaders(
            Inertia::render('Errors/NotFound', [
                'status' => 404,
                'path' => '/'.ltrim($request->path(), '/'),
                // The transit variant draws the landing page's city cards, whose
                // "N خط" badge and link are only right with the table's counts.
                // Sent on every 404 rather than re-deriving the page's own
                // section rule here, so the two cannot disagree about which 404
                // a visitor sees.
                'transitCities' => self::transitCityCards(),
            ])->toResponse($request)->setStatusCode(404)->prepare($request)
        );
    }

    /**
     * The cards the transit variant draws. A 404 has to render whatever is
     * wrong with the database — an unseeded or unreachable table must not turn
     * a missing page into a 500 — so a failed read leaves the grid empty.
     *
     * @return array<int, array{id: string, nameAr: string, nameEn: string, status: string, routeCount: int}>
     */
    private static function transitCityCards(): array
    {
        try {
            return app(TransitCities::class)->forCards();
        } catch (\Throwable $e) {
            Log::warning('404 transit city cards unavailable', ['error' => $e->getMessage()]);

            return [];
        }
    }
}
