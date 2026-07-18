<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveOptionalMobileBearerToken
{
    public function __construct(
        private readonly EnsureMobileBearerToken $mobileBearer,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->bearerToken()) {
            return $next($request);
        }

        return $this->mobileBearer->handle($request, $next);
    }
}
