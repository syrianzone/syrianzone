<?php

namespace App\Services\Transit;

use App\Models\Route;

/**
 * Outcome of TransitRouteComposer::combine().
 *
 * A tiny value object so the caller gets the new route plus the ids of the two
 * it superseded, without the service having to know about HTTP.
 */
final class CombineResult
{
    /**
     * @param  array<int, string>  $disapprovedIds
     */
    public function __construct(
        public readonly Route $route,
        public readonly array $disapprovedIds,
    ) {}
}
