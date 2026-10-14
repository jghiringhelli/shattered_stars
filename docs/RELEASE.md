# Releasing the beta (GitHub Pages)

The game is a static Vite build. CI checks every push, and pushing the `release` branch publishes the build to GitHub Pages. The online relay server is hosted separately (Fly.io / Render); see [MULTIPLAYER.md](../MULTIPLAYER.md).

| Workflow | Trigger | Does |
|---|---|---|
| [ci.yml](../.github/workflows/ci.yml) | every push and pull request | `npm ci` → lint → `tsc --noEmit` → unit, balance and simulation tests → build → uploads `dist/` as an artifact |
| [pages.yml](../.github/workflows/pages.yml) | push to `release`, or **Run workflow** | the same gates, then builds with `BASE_PATH=/<repo>/` and deploys `dist/` to Pages |

The URL is **https://jghiringhelli.github.io/shattered_stars/**

## Public test pre-flight checklist

Work top to bottom; nothing here deploys by itself. Tick each box before announcing the link.

### Configuration

| Variable | Where | Value |
|---|---|---|
| `VITE_ONLINE_URL` | GitHub › Settings › Secrets and variables › Actions › **Variables** | `wss://<relay host>` (`/ws` is added). Empty = the lobby says "no online server" and offers offline play |
| `VITE_FEEDBACK_URL` | same place (optional) | Empty = SEND FEEDBACK opens the repo's GitHub new-issue page. A form URL may use `{version} {commit} {mode} {scene} {kind} {title} {body}` placeholders |
| `VITE_GAME_BUILD` | set by `pages.yml` (commit SHA) | Only identical builds are matched online. Do not set by hand |
| `BASE_PATH` | set by `pages.yml` | `/shattered_stars/` for the project site |
| `ALLOWED_ORIGINS` | relay (`fly secrets set` / Render env) | Exactly `https://jghiringhelli.github.io` (origin only, no path). `*` is for local dev |

- [ ] The repo has the issue labels the templates use: `bug`, `balance`, `ui-ux`, `enhancement` (Issues › Labels).
- [ ] Pages is set up as in section 3 (source GitHub Actions, `release` allowed in the `github-pages` environment).

### Relay (skip if the beta is offline-only: leave `VITE_ONLINE_URL` empty)

- [ ] `npm run build:server` succeeds; `PORT=18080 node server/dist/server.cjs` answers `curl http://localhost:18080/healthz` with `{"status":"ok","protocol":<n>,...}` (checked 2026-10-14: 200, protocol 3).
- [ ] Deploy per [ONLINE.md](ONLINE.md#deploy-on-flyio): Fly (`fly launch --no-deploy --copy-config`, `fly deploy`, **one** machine) or Render (Blueprint, `starter` plan; the free plan sleeps).
- [ ] `curl https://<relay>/healthz` is `ok` and `protocol` equals `PROTOCOL_VERSION` in `src/net/protocol/version.ts`.
- [ ] `ALLOWED_ORIGINS` is set to the Pages origin; a page on another origin cannot connect.
- [ ] Set `VITE_ONLINE_URL`, run **Deploy to GitHub Pages**, then two browsers (one private window) quick-match and play a minute.
- [ ] Deploy the relay and the game together whenever the protocol version changes; deploy between play sessions (running matches are dropped).

### Quality gates (run locally, all green)

```bash
npm run lint
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.tests.json   # tests
npx vitest run tests/unit tests/balance tests/simulation
npm run test:skill
npm run build
npx tsx scripts/measure_first_load.ts      # first menu < 10 MB
npm run test:e2e                           # dev server on :3003
```

- [ ] `package.json` `version` bumped for this public build (the corner tag reads `vX.Y.Z BETA · <sha> · <date>`).
- [ ] [KNOWN_ISSUES.md](KNOWN_ISSUES.md), [PRIVACY.md](PRIVACY.md), [TESTER_GUIDE.md](TESTER_GUIDE.md) and the README play link are current.

### Legal

- [ ] The owner action items in [THIRD_PARTY.md](THIRD_PARTY.md) are done (above all: confirm the Suno plan allows commercial use of the shipped tracks, and the AI-model licences).
- [ ] `public/THIRD_PARTY_NOTICES.txt` matches `package-lock.json`; the credits screen shows the non-affiliation disclaimer.

### After publishing

- [ ] The URL loads, the tag matches the pushed commit, the welcome panel appears on first launch and TESTER INFO reopens it.
- [ ] Flight School starts; one Skirmish plays; SEND FEEDBACK downloads a file and opens the issue form.
- [ ] Online lobby connects (or shows the offline hint when no relay is configured).
- [ ] The Pages "Deploy" run is green; send testers the link and [TESTER_GUIDE.md](TESTER_GUIDE.md).

### Rollback

| What | How |
|---|---|
| Game (Pages) | `git push --force origin <good-sha>:release`, or re-run an earlier green "Deploy to GitHub Pages" run (see Rolling back below) |
| Relay on Fly | `fly releases` to find the previous version, then `fly deploy --image <previous image>`; check `/healthz` |
| Relay on Render | Dashboard › the service › Events/Deploys › **Rollback** to the previous deploy |
| Online switch off | Clear the `VITE_ONLINE_URL` variable and redeploy the game: the lobby then shows "no online server" and points to the offline modes |

If the protocol version changed, roll the game **and** the relay back to the same release, or clients are refused with "Game version out of date".
## 1. Check locally

```bash
npm ci
npm run lint
npx tsc --noEmit
npx vitest run tests/unit tests/balance tests/simulation
npm run build
npx tsx scripts/measure_first_load.ts      # bytes the menu needs; target < 10 MB
npm run test:e2e                           # optional; needs the dev server on :3003
```

To try the exact Pages build locally, use `BASE_PATH=/shattered_stars/ npm run build`, then `npx vite preview --base /shattered_stars/` and open `http://localhost:4173/shattered_stars/`.

## 2. Push the code

```bash
git push origin feat/arcade-pivot
# open a PR into master, let CI go green, merge
```

## 3. Enable GitHub Pages (once)

1. Go to the repo's **Settings › Pages › Build and deployment › Source** and choose **GitHub Actions**.
2. Go to **Settings › Environments › github-pages › Deployment branches and tags**, choose **Selected branches and tags**, and add `release`.
   The environment only accepts the default branch out of the box, and the deploy job fails with "Branch "release" is not allowed to deploy" until you add it.
3. Check **Settings › Actions › General**: Actions must be allowed. The workflows set their own token permissions.

## 4. Publish

```bash
git push origin master:release         # or: git push origin <commit>:release
```

Then:

1. Open **Actions › Deploy to GitHub Pages** and wait for both jobs (build, deploy) to go green.
2. Open the URL and check that the corner tag shows `v0.1.0 BETA · <short sha> · <date>`, matching the commit you pushed.
3. Run the "Release build checks" in [PLAYTEST_MVP.md](PLAYTEST_MVP.md#12-release-build-checks).

To publish again without a new commit: **Actions › Deploy to GitHub Pages › Run workflow** (pick `release`).

## Rolling back

Point `release` at the last good commit. This redeploys it.

```bash
git push --force origin <good-sha>:release
```

Alternatively, open that commit's earlier "Deploy to GitHub Pages" run and choose **Re-run all jobs**.

## Versioning

`package.json` `version` is the player-facing version. Bump it for each public build. The build adds the git short SHA and the build date (`vite.config.ts` `define`). The tag appears in the main menu, in bug reports and in telemetry exports.

## Bandwidth

GitHub Pages has a soft limit of 100 GB a month. The first menu downloads about 5 MB (measured 2026-10-14: 5.11 MB in 14 requests, 6.06 MB with the menu music; the whole `dist/` is 110 MB): JS, the menu backdrop and UI art. Mode art (ship sprites, portraits, backdrops, encyclopedia art) downloads per scene, only when needed. Art that no code references lives in `art-archive/` and is not shipped; re-audit it with `npx tsx scripts/audit_assets.ts`.
