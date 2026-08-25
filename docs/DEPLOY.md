# Deploying Shattered Stars to GitHub Pages

The game is a fully static Vite build (`npm run build` → `dist/`). Vite `base` is
`'./'` (relative), so the build works from any sub-path — including a GitHub Pages
project site at `https://<user>.github.io/shattered_stars/`.

## One-time setup (manual, in the GitHub UI)

1. Push this branch to `master`/`main` on the origin remote.
2. Repo **Settings → Pages → Build and deployment → Source**: select **GitHub Actions**.

That's it — no `base` path edit is needed because the build uses relative asset URLs.

## Publishing

The deploy workflow ([.github/workflows/pages.yml](.github/workflows/pages.yml)) is
**manual by design** — it will not publish on its own.

- Go to the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**.
- To switch to automatic publishing on every push to `master`/`main`, uncomment the
  `push:` trigger block at the top of the workflow.

The workflow type-checks, builds, uploads `dist/` as the Pages artifact, and deploys it.

## Runtime notes

- The game degrades gracefully when the local art/music services are absent: the
  Stable Diffusion queue (port 8010) and Harmonia (port 8002) are **development-only**
  tools and are not contacted by the shipped build. Missing optional art (e.g. the
  `synth_gestalt` encyclopedia image) is fail-silent.
- All gameplay assets under `public/` are copied into `dist/` by Vite automatically.
- Player profiles and campaign saves use `localStorage`, so progression persists
  per-browser on the deployed site.
