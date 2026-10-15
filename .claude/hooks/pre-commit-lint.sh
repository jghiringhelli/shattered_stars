#!/usr/bin/env bash
# ESLint on the staged src files only (max-warnings 0: the tree is warning-free).
FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^src/.*\.ts$')
if [ -z "$FILES" ]; then
  echo "  lint: no staged src files, skipped"
  exit 0
fi
# shellcheck disable=SC2086
if ! npx --no-install eslint --max-warnings=0 $FILES 2>&1; then
  echo "ESLint failed on staged files."
  exit 1
fi
echo "  lint: eslint OK ($(echo "$FILES" | wc -l | tr -d ' ') files)"
