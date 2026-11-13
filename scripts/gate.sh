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

step 'frontend tests — npm run test:js'
npm run test:js

step 'PHP tests — vendor/bin/pest --parallel'
vendor/bin/pest --parallel

# Advisory on purpose: roughly 170 pre-existing files are not Pint-clean, so a
# hard failure here would block every change on unrelated formatting. The
# result is printed so the drift stays visible; it never sets the exit code.
step 'PHP lint — vendor/bin/pint --test (advisory)'
if ! vendor/bin/pint --test; then
    printf '\n! Pint lists files that need formatting. Advisory only: not a failure.\n'
fi
