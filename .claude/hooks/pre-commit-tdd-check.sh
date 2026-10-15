#!/usr/bin/env bash
# TDD gate. A test-only commit must contain at least one FAILING test (RED);
# implementation without test changes only warns.
STAGED=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$STAGED" ] && exit 0

SRC_FILES=$(echo "$STAGED" | grep -E '^(src|lib|app|server|client|pkg|internal|cmd)/' || true)
TEST_FILES=$(echo "$STAGED" | grep -E '^(tests?|spec|__tests__)/|\.(test|spec)\.(ts|tsx|js|jsx|mjs)$' | grep -vE '^tests/(e2e|skill)/' || true)

if [ -n "$TEST_FILES" ] && [ -z "$SRC_FILES" ]; then
  # Only .test.ts files are unit tests; builders/fixtures are not runnable.
  RUNNABLE=$(echo "$TEST_FILES" | grep -E '\.test\.ts$' || true)
  [ -z "$RUNNABLE" ] && exit 0
  echo "TDD gate: test-only commit, running staged tests..."
  # shellcheck disable=SC2086
  OUTPUT=$(npx --no-install vitest run $RUNNABLE 2>&1)
  if [ $? -eq 0 ]; then
    echo "TDD RED gate violation: all staged tests PASS."
    echo "A test-only commit must contain at least one failing test."
    echo "If these tests cover already-implemented behavior, commit them together with the code, or with a 'docs'/'chore' scope."
    echo "$OUTPUT" | tail -n 15
    exit 1
  fi
  echo "  RED gate satisfied: staged tests fail as expected"
fi

if [ -n "$SRC_FILES" ] && [ -z "$TEST_FILES" ]; then
  echo "TDD warning: implementation committed without test changes."
fi
exit 0
