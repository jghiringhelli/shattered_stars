#!/usr/bin/env bash
# Scans only the ADDED lines of the staged diff (fast, no binary files).
PATTERNS=(
  'AKIA[0-9A-Z]{16}'
  'password[[:space:]]*=[[:space:]]*["'"'"'][^"'"'"']+'
  'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY'
  'sk-[a-zA-Z0-9]{48}'
  'ghp_[a-zA-Z0-9]{36}'
  'github_pat_[a-zA-Z0-9_]{50,}'
)
ADDED=$(git diff --cached --no-color -U0 --diff-filter=ACMR -- . ':(exclude)package-lock.json' ':(exclude)*.png' ':(exclude)*.ogg' ':(exclude)*.mp3' | grep -E '^\+[^+]' || true)
[ -z "$ADDED" ] && exit 0
for pattern in "${PATTERNS[@]}"; do
  if echo "$ADDED" | grep -qE -e "$pattern"; then
    echo "Potential secret in staged changes (pattern: $pattern). Remove it or use an environment variable."
    exit 1
  fi
done
exit 0
