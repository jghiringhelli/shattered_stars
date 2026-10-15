#!/usr/bin/env bash
# Related tests only: vitest runs the tests that import the staged src/tests/server files.
# The full suite (with coverage) is CI's job and `npm run verify:full`.
# A change to a core module can fan out to hundreds of tests; the run is capped at
# HOOK_TEST_TIMEOUT_SECONDS (default 90). Hitting the cap is a warning (CI runs the rest),
# a failing test always blocks.
FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^(src|tests|server)/.*\.(ts|tsx)$' | grep -vE '^tests/(e2e|skill)/')
if [ -z "$FILES" ]; then
  echo "  test: no staged src/tests files, skipped"
  exit 0
fi
LIMIT="${HOOK_TEST_TIMEOUT_SECONDS:-90}"
# shellcheck disable=SC2086
timeout "$LIMIT" npx --no-install vitest related --run --passWithNoTests --bail=1 $FILES 2>&1
STATUS=$?
if [ "$STATUS" -eq 124 ]; then
  echo "  test: WARNING related tests hit the ${LIMIT}s cap without a failure; CI runs the full suite."
  exit 0
fi
if [ "$STATUS" -ne 0 ]; then
  echo "Related tests failed."
  exit 1
fi
echo "  test: related tests passed"
