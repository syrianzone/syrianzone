<?php

use Illuminate\Routing\Route;

test('every named route has a unique name', function () {
    $names = collect(app('router')->getRoutes()->getRoutes())
        ->map(fn (Route $route): ?string => $route->getName())
        ->filter()
        ->values();

    expect($names->duplicates()->unique()->values()->all())->toBe([]);
});

test('every route method and URI signature is unique', function () {
    $signatures = collect(app('router')->getRoutes()->getRoutes())
        ->flatMap(fn (Route $route): array => collect($route->methods())
            ->map(fn (string $method): string => implode('|', [
                $route->getDomain() ?? '',
                $method,
                $route->uri(),
            ]))
            ->all());

    expect($signatures->duplicates()->unique()->values()->all())->toBe([]);
});
