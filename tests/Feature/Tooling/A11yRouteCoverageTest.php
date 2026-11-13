<?php

use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;

/**
 * The axe sweep's route list and the client's deferred-page prefixes both restate
 * something the app already knows: the route table and the page folders. Neither
 * is trusted here — this test reads both sides and fails on drift, so a new
 * Inertia page cannot go unswept and a renamed page folder cannot silently lose
 * its chunk split.
 *
 * AGENTS.md's accessibility rule ("the axe sweep must stay at 0 violations") only
 * covers the routes the sweep actually visits, so the sweep's coverage is the
 * thing worth asserting.
 */

/** The route paths the sweep visits, from `scripts/a11y_axe_audit.py`. */
function auditedPaths(): array
{
    $script = (string) file_get_contents(base_path('scripts/a11y_axe_audit.py'));
    $paths = [];

    foreach (['PUBLIC_ROUTES', 'ADMIN_ROUTES'] as $list) {
        $pattern = '/^'.$list.' = \[(.*?)^\]/ms';
        if (preg_match($pattern, $script, $block) !== 1) {
            throw new RuntimeException("scripts/a11y_axe_audit.py has no {$list} list.");
        }
        preg_match_all('/"([^"]+)"/', $block[1], $entries);
        array_push($paths, ...$entries[1]);
    }

    return array_values(array_unique($paths));
}

/**
 * The Inertia routes the sweep does not visit, each with the reason. A route
 * belongs here only when it cannot be swept as it stands (an axe finding, or
 * content that only exists for a signed-in record); "the list is old" is not a
 * reason.
 */
const A11Y_ROUTE_EXCLUSIONS = [
    'games/tarneeb' => 'No <main> landmark and no <h1> on the table page (axe: landmark-one-main, page-has-heading-one). Owned by Pages/Games; add to PUBLIC_ROUTES once the page has a landmark.',
    'games/trix' => 'Same two findings as games/tarneeb: a table page without a <main> landmark or an <h1>. Owned by Pages/Games.',
    'tierlist/leaderboard' => 'The chart\'s three filter rows are Radix Tabs with no TabsContent, so every trigger\'s aria-controls points at an element that does not exist (axe: aria-valid-attr-value, critical). Sweep it once Pages/Polls/_components/TimeseriesChart.tsx stops naming a panel it never renders.',
    'compass/stats' => 'The two answer pickers are Select triggers with no accessible name, because the shared Select primitive does not label its trigger (axe: button-name, critical). Sweep it once Components/ui/select names the control.',
    'admin/api-tokens' => 'The token table renders an empty <th> while a token is pending (axe: empty-table-header). Sweep it once the table header is named.',
    'admin/compass' => 'Same unlabelled Select trigger as compass/stats (axe: button-name, critical). Owned by the shared Select primitive.',
    'admin/compass/figures' => 'Same unlabelled Select trigger as compass/stats (axe: button-name, critical). Owned by the shared Select primitive.',
    'admin/compass/personas' => 'Same unlabelled Select trigger as compass/stats (axe: button-name, critical). Owned by the shared Select primitive.',
];

/** Does this route's action body render an Inertia page? */
function rendersInertiaPage(RoutingRoute $route): bool
{
    $action = $route->getAction('uses');

    if ($action instanceof Closure) {
        $reflection = new ReflectionFunction($action);
    } elseif (is_string($action) && str_contains($action, '@')) {
        [$class, $method] = explode('@', $action);
        if (! class_exists($class) || ! method_exists($class, $method)) {
            return false;
        }
        $reflection = new ReflectionMethod($class, $method);
    } else {
        return false;
    }

    $file = $reflection->getFileName();
    if ($file === false || ! is_readable($file)) {
        return false;
    }

    $lines = array_slice(
        file($file, FILE_IGNORE_NEW_LINES) ?: [],
        max(0, $reflection->getStartLine() - 1),
        $reflection->getEndLine() - $reflection->getStartLine() + 1,
    );
    $body = implode("\n", $lines);

    return str_contains($body, 'Inertia::render(') || preg_match('/\binertia\(/', $body) === 1;
}

/** Every Inertia page route the sweep could visit, as `/path`. */
function inertiaPagePaths(): array
{
    $paths = [];

    foreach (Route::getRoutes() as $route) {
        if (! in_array('GET', $route->methods(), true)) {
            continue;
        }
        // Inertia pages are web routes; this skips the API, Filament, MCP and
        // asset endpoints in one go.
        if (! in_array('web', $route->gatherMiddleware(), true)) {
            continue;
        }
        // A parameterised route has no URL to visit without a record.
        if (str_contains($route->uri(), '{')) {
            continue;
        }
        if (! rendersInertiaPage($route)) {
            continue;
        }
        $paths[] = '/'.ltrim($route->uri(), '/');
    }

    sort($paths);

    return array_values(array_unique($paths));
}

test('every Inertia route is audited by the axe sweep or excluded with a reason', function () {
    $audited = auditedPaths();
    $excluded = array_map(fn (string $path) => '/'.ltrim($path, '/'), array_keys(A11Y_ROUTE_EXCLUSIONS));

    $unswept = array_values(array_diff(inertiaPagePaths(), $audited, $excluded));
    expect($unswept)->toBe([], implode("\n", [
        'These routes render an Inertia page but the axe sweep never visits them,',
        'so its "0 violations" says nothing about them. Either add the path to',
        'PUBLIC_ROUTES/ADMIN_ROUTES in scripts/a11y_axe_audit.py, or list it in',
        'A11Y_ROUTE_EXCLUSIONS with the reason it cannot be swept:',
        ...$unswept,
    ]));
});

test('the sweep only visits routes that exist, and repeats no route', function () {
    $paths = auditedPaths();

    expect($paths)->toBe(array_values(array_unique($paths)), 'scripts/a11y_axe_audit.py lists a route twice.');

    $registered = collect(Route::getRoutes())
        ->map(fn (RoutingRoute $route) => '/'.ltrim($route->uri(), '/'))
        ->unique()
        ->all();

    $unknown = array_values(array_filter($paths, fn (string $path) => ! in_array($path, $registered, true)));
    expect($unknown)->toBe([], 'scripts/a11y_axe_audit.py visits routes that are not registered: '.implode(', ', $unknown));
});

test('every exclusion names a real, unswept Inertia route and says why', function () {
    $inertia = inertiaPagePaths();
    $audited = auditedPaths();

    foreach (A11Y_ROUTE_EXCLUSIONS as $path => $reason) {
        $route = '/'.ltrim($path, '/');
        expect(in_array($route, $inertia, true))
            ->toBeTrue("A11Y_ROUTE_EXCLUSIONS lists {$route}, which is not an Inertia route any more.");
        expect(in_array($route, $audited, true))
            ->toBeFalse("{$route} is excluded and swept: delete the exclusion.");
        expect(trim($reason))->not->toBe('', "A11Y_ROUTE_EXCLUSIONS has no reason for {$route}.");
    }
});

test('every DEFERRED_PAGES prefix resolves to a Pages/ folder', function () {
    $source = (string) file_get_contents(resource_path('js/Lib/pages.ts'));

    expect(preg_match('/const DEFERRED_PAGES = \[(.*?)\]/s', $source, $block))
        ->toBe(1, 'Lib/pages.ts no longer declares DEFERRED_PAGES as a literal array.');

    preg_match_all("/'([^']+)'/", $block[1], $entries);
    $prefixes = $entries[1];
    expect($prefixes)->not->toBe([], 'Lib/pages.ts lists no deferred page.');

    foreach ($prefixes as $prefix) {
        $folder = resource_path('js/Pages/'.$prefix);
        expect(is_dir($folder))->toBeTrue(
            "Lib/pages.ts defers \"{$prefix}\", which is not a folder under resources/js/Pages.",
        );
    }
});
