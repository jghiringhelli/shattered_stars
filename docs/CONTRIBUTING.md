# Contributing

Short version: install, hook up, write the test first, keep the ratchet green.

```bash
npm ci
npm run hooks:setup      # once per clone: git hooks live in .claude/hooks
npm run dev              # http://localhost:3000
```

Node >= 22 (`.nvmrc`). Read [CLAUDE.md](../CLAUDE.md) for the code standards (SOLID, TDD, <= 50-line functions, <= 300-line files, <= 5 parameters, JSDoc on public functions, no hard-coded values).

## Everyday commands

| Command | What it does |
|---|---|
| `npm run typecheck:all` | `tsc` for src + server, then tests + scripts (`tsconfig.tests.json`) |
| `npm run lint` | ESLint on `src` |
| `npm run check:cycles` | Import-cycle gate (offline, replaces `npx madge`) |
| `npm run quality` | Lists every file/function/parameter-limit offender (the debt) |
| `npm run quality:check` | Fails on NEW or WORSENED offenders (what the hook and CI run) |
| `npm run test:unit` | Unit + balance + simulation suites (what CI shards 4 ways) |
| `npm run test:skill` | Piloting skill gates (`SKILL_PAIRS=all` for the whole matrix) |
| `npm run test:e2e` | Playwright against the dev server on :3003 |
| `npm run verify:full` | Everything the pre-commit hook skips: typecheck, lint, cycles, ratchet, full suite with coverage, skill gates |
| `npm run measure:first-load` | Downloads the built game like a player and prints the first-menu size (CI budget 10 MB) |

## Pre-commit hook (target: under 90 s)

`.claude/hooks/pre-commit` runs cheap gates first, then the heavy ones in parallel:

1. Sequential, fail fast: branch check (no direct commits to `main`/`master`), secrets scan of the added lines, whitespace/conflict markers, **quality ratchet**, hard-coded-host and mock-data scan, TDD gate.
2. In parallel: `tsc` (src) + `tsc` (tests/scripts), ESLint on the staged `src` files, import cycles, and `vitest related --run` for the staged src/tests/server files (capped at `HOOK_TEST_TIMEOUT_SECONDS`, default 90; a failing test always blocks, hitting the cap only warns because CI runs the whole suite).

The full suite with coverage is **not** in the hook any more: it runs in CI and in `npm run verify:full`. Never bypass the hook with `--no-verify`; if it is wrong, fix the hook.

TDD gate: a commit with only test files must contain at least one failing test (RED). Commit the test together with the implementation, or in the same branch before it. `commit-msg` enforces conventional commits (`feat(scope): ...`).

### Quality ratchet

The limits of CLAUDE.md (300 lines/file, 50 lines/function, 5 parameters) are enforced as a ratchet: the offenders that existed when the ratchet was introduced are recorded in `scripts/quality-baseline.json` and tolerated; a staged file may not add a new offender or make a recorded one longer. When you shrink a file or function below its limit, run `npm run quality:baseline` in the same commit to lock the improvement (the baseline only ever shrinks).

## CI

`.github/workflows/ci.yml` (every push and PR, also the gate in front of the Pages deploy):

| Job | Content |
|---|---|
| `static` | lint, both `tsc` configs, import cycles, quality ratchet |
| `unit` (4 shards) | `vitest run tests/unit tests/balance tests/simulation --shard=n/4` |
| `integration` | relay integration test |
| `skill` | `npm run test:skill` |
| `build` | `npm run build`, then the first-load budget (fails above 10 MB) |
| `e2e` (4 shards) | Playwright on chromium against the dev server (`window.game` only exists in dev builds), retries 1, traces on failure |
| `cross-browser` | Firefox/WebKit smoke, non-blocking |
| `audit` | `npm audit`, report only |

`nightly.yml` runs the balance report, the telemetry battery (artifact: `docs/balance`, `docs/telemetry`), the full suite with coverage and the whole skill matrix. Dependabot opens grouped weekly npm updates and monthly Actions updates.

## Releases

1. Move the `[Unreleased]` entries of [CHANGELOG.md](../CHANGELOG.md) under a new `## [x.y.z] - date` heading (Keep a Changelog; sections Added / Changed / Fixed / Security).
2. Bump `version` in `package.json` and `package-lock.json` (semver; pre-releases `-alpha.n`, `-beta.n`, `-rc.n`).
3. Commit, then tag and push: `git tag vX.Y.Z && git push --tags`.
4. `release.yml` checks that the tag equals `package.json`, builds, zips `dist/`, and creates the GitHub release with that CHANGELOG section as notes (a pre-release part marks it as pre-release).

Deploying the game to GitHub Pages is separate: push `release` (see [RELEASE.md](RELEASE.md)).

## Security and configuration

- The production build ships a Content-Security-Policy (`<meta>` plus `dist/_headers`): scripts only from the page itself, connections only to `self` and the relay origin of `VITE_ONLINE_URL`. A relay that is not configured at build time cannot be reached; `?server=` overrides therefore only work on dev builds.
- The relay refuses to start in production without an explicit `ALLOWED_ORIGINS` and ignores `X-Forwarded-For` unless `TRUST_PROXY=true` ([ONLINE.md](ONLINE.md)).

## Player-facing text

New UI strings go through `t("area.screen.purpose")` ([I18N.md](I18N.md)); a unit test fails when a key is missing or unused.
