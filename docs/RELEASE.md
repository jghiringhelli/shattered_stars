# Releasing the alpha (GitHub Pages)

The game is a static Vite build. CI checks every push, and pushing the `release` branch publishes the build to GitHub Pages. The online relay server is hosted separately (Fly.io / Render); see [MULTIPLAYER.md](../MULTIPLAYER.md).

| Workflow | Trigger | Does |
|---|---|---|
| [ci.yml](../.github/workflows/ci.yml) | every push and pull request | `npm ci` → lint → `tsc --noEmit` → unit, balance and simulation tests → build → uploads `dist/` as an artifact |
| [pages.yml](../.github/workflows/pages.yml) | push to `release`, or **Run workflow** | the same gates, then builds with `BASE_PATH=/<repo>/` and deploys `dist/` to Pages |

The URL is **https://jghiringhelli.github.io/shattered_stars/**

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
2. Open the URL and check that the corner tag shows `v0.1.0 ALPHA · <short sha> · <date>`, matching the commit you pushed.
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

GitHub Pages has a soft limit of 100 GB a month. The first menu downloads about 4 MB: JS, the menu backdrop and UI art (the exact figure is in the release report). Mode art (ship sprites, portraits, backdrops, encyclopedia art) downloads per scene, only when needed. Art that no code references lives in `art-archive/` and is not shipped; re-audit it with `npx tsx scripts/audit_assets.ts`.
