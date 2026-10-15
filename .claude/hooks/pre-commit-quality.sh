#!/usr/bin/env bash
# Quality ratchet: CLAUDE.md limits (300 lines/file, 50 lines/function, 5 params) fail
# only for NEW or WORSENED violations in staged src files; recorded debt lives in
# scripts/quality-baseline.json. List the debt with `npm run quality`.
if ! git diff --cached --name-only --diff-filter=ACM | grep -qE '^(src|server/src)/.*\.tsx?$'; then
  exit 0
fi
if ! npx --no-install tsx scripts/quality_check.ts --staged; then
  exit 1
fi
