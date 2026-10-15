#!/usr/bin/env bash
# Formatting gate: no whitespace errors / conflict markers in the staged diff.
# Prettier is not a project dependency; if a project-local one is ever installed it is used too (check only).
if ! git diff --cached --check; then
  echo "Whitespace errors or conflict markers in the staged diff (see above)."
  exit 1
fi
if [ -x node_modules/.bin/prettier ]; then
  FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|json|md|yml)$' | grep -vE '^(package-lock\.json|public/)')
  if [ -n "$FILES" ]; then
    # shellcheck disable=SC2086
    node_modules/.bin/prettier --check $FILES || { echo "Run: npx prettier --write <files>"; exit 1; }
  fi
fi
exit 0
