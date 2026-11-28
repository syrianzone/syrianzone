<?php

use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Documentation Index Coverage
|--------------------------------------------------------------------------
|
| `docs/INDEX.md` is the canonical router for all active documentation.
| Every active Markdown file under `docs/` (excluding `docs/archive/**`,
| `docs/README.md`, and `docs/INDEX.md` itself) must be linked from
| `docs/INDEX.md`, and every relative Markdown link inside `docs/INDEX.md`
| must resolve to an existing file on disk.
|
*/

test('every active doc under docs/ is linked from docs/INDEX.md', function () {
    $docsRoot = dirname(__DIR__, 3).DIRECTORY_SEPARATOR.'docs';
    $indexPath = $docsRoot.DIRECTORY_SEPARATOR.'INDEX.md';

    expect(is_file($indexPath))->toBeTrue('docs/INDEX.md must exist');

    $indexContent = file_get_contents($indexPath);
    expect($indexContent)->toBeString();

    preg_match_all('/\[[^\]]+\]\(([^)#]+)(?:#[^)]*)?\)/', $indexContent, $matches);

    $linkedRelativePaths = collect($matches[1])
        ->filter(fn (string $target): bool => ! Str::startsWith($target, ['http://', 'https://', 'mailto:']))
        ->map(function (string $target) use ($docsRoot): ?string {
            $resolved = realpath($docsRoot.DIRECTORY_SEPARATOR.$target);
            if ($resolved === false) {
                return null;
            }

            $docsReal = realpath($docsRoot);
            if ($docsReal === false || ! Str::startsWith($resolved, $docsReal.DIRECTORY_SEPARATOR)) {
                return null;
            }

            return str_replace('\\', '/', substr($resolved, strlen($docsReal) + 1));
        })
        ->filter()
        ->unique()
        ->values();

    $activeDocs = collect();
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($docsRoot, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if (! $file->isFile() || strtolower($file->getExtension()) !== 'md') {
            continue;
        }

        $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($docsRoot) + 1));

        if ($relative === 'INDEX.md' || $relative === 'README.md' || Str::startsWith($relative, 'archive/')) {
            continue;
        }

        $activeDocs->push($relative);
    }

    $missing = $activeDocs->diff($linkedRelativePaths)->sort()->values()->all();

    expect($missing)->toBe(
        [],
        'Active docs missing from docs/INDEX.md: '.implode(', ', $missing)
    );
});

test('every relative markdown link in docs/INDEX.md resolves to an existing file', function () {
    $docsRoot = dirname(__DIR__, 3).DIRECTORY_SEPARATOR.'docs';
    $indexPath = $docsRoot.DIRECTORY_SEPARATOR.'INDEX.md';
    $indexContent = file_get_contents($indexPath);

    expect($indexContent)->toBeString();

    preg_match_all('/\[[^\]]+\]\(([^)#]+)(?:#[^)]*)?\)/', $indexContent, $matches);

    $broken = [];

    foreach ($matches[1] as $target) {
        if (Str::startsWith($target, ['http://', 'https://', 'mailto:'])) {
            continue;
        }

        $candidate = $docsRoot.DIRECTORY_SEPARATOR.$target;
        if (! file_exists($candidate)) {
            $broken[] = $target;
        }
    }

    expect($broken)->toBe(
        [],
        'Broken relative links in docs/INDEX.md: '.implode(', ', $broken)
    );
});
