#!/usr/bin/env bash
# Import cycles: local, offline Tarjan check (scripts/check_import_cycles.ts); no network fetch.
if ! git diff --cached --name-only --diff-filter=ACMR | grep -qE '^(src|server/src)/.*\.tsx?$'; then
  echo "  import-cycles: no staged src files, skipped"
  exit 0
fi
if ! npx --no-install tsx scripts/check_import_cycles.ts 2>&1; then
  echo "Circular imports detected."
  exit 1
fi
echo "  import-cycles: none"
