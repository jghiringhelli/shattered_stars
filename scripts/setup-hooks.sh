#!/usr/bin/env bash
# Installs the repository hooks (.claude/hooks) as git's hooksPath. Run once per clone: npm run hooks:setup
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .claude/hooks
chmod +x .claude/hooks/* 2>/dev/null || true
echo "Hooks installed (core.hooksPath = .claude/hooks)."
echo "Pre-commit: tsc x2, eslint (staged), related tests, quality ratchet, secrets, cycles."
echo "Full suite + coverage + skill gates: npm run verify:full (and CI)."
