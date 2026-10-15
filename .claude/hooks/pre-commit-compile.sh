#!/usr/bin/env bash
# Type-check both projects (src + server, then tests + scripts). Incremental, so repeat runs are fast.
STAGED=$(git diff --cached --name-only --diff-filter=ACMR)
if ! echo "$STAGED" | grep -qE '\.(ts|tsx)$|^tsconfig.*\.json$|^package(-lock)?\.json$'; then
  echo "  compile: no TypeScript changes, skipped"
  exit 0
fi

CACHE_DIR="node_modules/.cache/precommit"
mkdir -p "$CACHE_DIR"

npx --no-install tsc --noEmit --incremental --tsBuildInfoFile "$CACHE_DIR/src.tsbuildinfo" 2>&1 &
SRC_PID=$!
npx --no-install tsc -p tsconfig.tests.json --noEmit --incremental --tsBuildInfoFile "$CACHE_DIR/tests.tsbuildinfo" 2>&1 &
TESTS_PID=$!

STATUS=0
wait "$SRC_PID" || STATUS=1
wait "$TESTS_PID" || STATUS=1
if [ "$STATUS" -ne 0 ]; then
  echo "TypeScript compilation failed (tsconfig.json and/or tsconfig.tests.json)."
  exit 1
fi
echo "  compile: tsc (src + tests/scripts) OK"
