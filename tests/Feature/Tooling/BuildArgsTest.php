<?php

/**
 * The browser Sentry configuration is one list of names repeated in four places
 * that only ever run in production: the Dockerfile's ARG/ENV lines, the two
 * deploy workflows' build-args, and the code that consumes them (vite.config.js
 * for the sourcemap upload, resources/js for the bundle). A name typo in one of
 * them is invisible in review and only shows up as "why is my bundle empty".
 *
 * This test parses the names from each place and asserts the sets agree, with the
 * two per-environment exceptions named and checked below.
 */

/** Whether a name belongs to the browser Sentry contract this file guards. */
function isSentryBuildName(string $name): bool
{
    // SENTRY_RELEASE is the server SDK's release name, derived from GIT_SHA in
    // the image; it is not part of the browser contract this file guards.
    return str_starts_with($name, 'VITE_SENTRY_') || in_array($name, ['SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN'], true);
}

/** The VITE_/SENTRY_ names the image declares as build args or environment. */
function dockerBuildNames(): array
{
    // Join ENV continuation lines so a multi-line ENV block is one statement.
    $dockerfile = (string) preg_replace('/\\\\\n/', ' ', (string) file_get_contents(base_path('Dockerfile')));

    preg_match_all('/^(?:ARG|ENV)\s+(.+)$/m', $dockerfile, $statements);
    preg_match_all('/\b((?:VITE|SENTRY)_[A-Z0-9_]+)\b/', implode(' ', $statements[1]), $names);

    return array_values(array_filter(array_unique($names[1]), 'isSentryBuildName'));
}

/** The build-arg names a workflow passes to docker/build-push-action. */
function workflowBuildNames(string $workflow): array
{
    $source = (string) file_get_contents(base_path('.github/workflows/'.$workflow));

    if (! preg_match('/^(\s*)build-args: \|\n((?:\1\s+.*\n)+)/m', $source, $block)) {
        return [];
    }

    preg_match_all('/^\s*([A-Z0-9_]+)=/m', $block[2], $names);
    $names = array_values(array_unique($names[1]));

    return array_values(array_filter($names, 'isSentryBuildName'));
}

/** The environment names vite.config.js reads (the sourcemap upload). */
function viteConfigNames(): array
{
    preg_match_all('/process\.env\.([A-Z0-9_]+)/', (string) file_get_contents(base_path('vite.config.js')), $names);

    return array_values(array_filter(array_unique($names[1]), 'isSentryBuildName'));
}

/** The Sentry names the client bundle reads through import.meta.env. */
function bundleNames(): array
{
    $names = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(resource_path('js')));
    foreach ($files as $file) {
        if ($file->isFile() && preg_match('/\.(ts|tsx)$/', $file->getFilename())) {
            preg_match_all('/import\.meta\.env\.([A-Z0-9_]+)/', (string) file_get_contents($file->getPathname()), $matches);
            foreach ($matches[1] as $name) {
                if (isSentryBuildName($name)) {
                    $names[$name] = true;
                }
            }
        }
    }

    return array_keys($names);
}

test('production passes only build args the image declares, and declares nothing it never receives', function () {
    $declared = dockerBuildNames();
    $deployed = workflowBuildNames('deploy.yml');

    expect(array_diff($deployed, $declared))->toBe([]);

    // VITE_SENTRY_RELEASE is not passed: the image derives it from GIT_SHA, which
    // the workflow does pass. That is the one declared name without a build arg.
    expect(array_values(array_diff($declared, $deployed)))->toBe(['VITE_SENTRY_RELEASE']);
    expect((string) file_get_contents(base_path('Dockerfile')))->toContain('VITE_SENTRY_RELEASE=${GIT_SHA}');
});

test('staging deliberately passes no Sentry build args, and says so', function () {
    $staging = (string) file_get_contents(base_path('.github/workflows/deploy-staging.yml'));

    // Sending the production DSN would make staging report browser errors into
    // the production project. The workflow carries the explanation; if the args
    // are ever added back, that comment has to go with them.
    expect(workflowBuildNames('deploy-staging.yml'))->toBe([])
        ->and($staging)->toContain('deliberately NOT passing VITE_SENTRY_DSN');
});

test('every declared name is consumed, and every consumed name is declared', function () {
    $declared = dockerBuildNames();

    // SENTRY_AUTH_TOKEN is the one name the image receives as a build secret
    // rather than an ARG, so it must not be in the ARG/ENV list.
    expect($declared)->not->toContain('SENTRY_AUTH_TOKEN');
    expect((string) file_get_contents(base_path('Dockerfile')))->toContain('id=sentry_auth_token');

    $consumed = array_values(array_unique([...bundleNames(), ...viteConfigNames(), 'SENTRY_AUTH_TOKEN']));

    expect(array_values(array_diff($consumed, $declared)))->toBe(['SENTRY_AUTH_TOKEN'])
        ->and(array_values(array_diff($declared, $consumed)))->toBe([]);
});
