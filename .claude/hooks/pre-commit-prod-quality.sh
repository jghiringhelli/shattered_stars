#!/usr/bin/env bash
# Production-code anti-patterns in staged src files (hardcoded hosts, mock data).
# File/function length is enforced by pre-commit-quality.sh (ratchet).
STAGED=$(git diff --cached --name-only --diff-filter=ACM)
SOURCE_FILES=$(echo "$STAGED" | grep -E '^(src|server/src)/.*\.(ts|tsx)$' | grep -vE '(\.test\.|\.spec\.|__tests__|fixtures/|mock)')
[ -z "$SOURCE_FILES" ] && exit 0

VIOLATIONS=0
for file in $SOURCE_FILES; do
  # Only lines ADDED by this commit are judged.
  CONTENT=$(git diff --cached --no-color -U0 -- "$file" | grep -E '^\+[^+]' || true)
  if ! echo "$file" | grep -qE '(config|settings|\.env)'; then
    if echo "$CONTENT" | grep -E '(localhost|127\.0\.0\.1|0\.0\.0\.0)' | grep -qvE '^\+[[:space:]]*(//|\*|/\*)'; then
      echo "  $file: hardcoded URL/host"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
  if echo "$CONTENT" | grep -qEi '\b(mock_data|fake_data|dummy_data|stub_response)'; then
    echo "  $file: mock/stub data in production code"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "$VIOLATIONS production-quality violation(s): commit blocked."
  exit 1
fi
exit 0
