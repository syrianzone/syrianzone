#!/usr/bin/env bash
#
# The gate. These are the commands AGENTS.md documents, in the order CI runs
# them, so the enforced gate and the documented one cannot drift.
# .github/workflows/tests.yml calls this script.
#
#   bash scripts/gate.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

step() {
    printf '\n== %s\n' "$1"
}

step 'typecheck — npx tsc --noEmit'
npx tsc --noEmit

step 'lint — npm run lint (hooks, no-alert, no-console, api boundary)'
npm run lint

step 'frontend tests — npm run test:js'
npm run test:js

step 'build — npm run build (client + SSR)'
npm run build

step 'answer card renderer tests — node --test'
node --test scripts/answers-card/render.test.mjs

step 'OG images freshness — npm run og:check'
npm run og:check

# Guard against a worktree symlink pointing outside this checkout: Composer's
# autoloader resolves paths relative to vendor/'s realpath, so a symlink to the
# main repo causes Pest to run the main repo's app/ code instead of this tree.
if [ -L vendor ]; then
    vendor_target="$(readlink -f vendor)"
    case "$vendor_target" in
        "$PWD"/*) ;;
        *)
            printf '\nERROR: vendor/ is a symlink pointing outside this worktree (%s).\n' "$vendor_target" >&2
            printf 'Replace it with a local install (`rm vendor && composer install`) so Pest tests this checkout.\n' >&2
            exit 1
            ;;
    esac
fi

step 'PHP tests — vendor/bin/pest --parallel'
vendor/bin/pest --parallel

# Advisory on purpose: roughly 170 pre-existing files are not Pint-clean, so a
# hard failure here would block every change on unrelated formatting. The
# result is printed so the drift stays visible; it never sets the exit code.
step 'PHP lint — vendor/bin/pint --test (advisory)'
if ! vendor/bin/pint --test; then
    printf '\n! Pint lists files that need formatting. Advisory only: not a failure.\n'
fi
