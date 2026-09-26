<?php

namespace App\Services\Transit;

use App\Models\Route;

/**
 * Outcome of TransitRouteComposer::split().
 */
final class SplitResult
{
    public function __construct(
        public readonly Route $routeA,
        public readonly Route $routeB,
        public readonly string $originalRouteId,
    ) {}
}
