# Asset Generation Runbook (Stable Diffusion)

How to start the local image backend and generate/regenerate ship art, portraits,
and UI textures for Shattered Stars. **All game art is produced locally — no cloud calls.**

## Architecture

```
generate_*.py  ──writes──▶  local queue (~/.sd_queue/jobs/*.pending.json)
                                     │
             ┌───────────────────────┴───────────────────────┐
             ▼                                                ▼
   sd_queue.py worker                          direct_forge_worker.py
   (POST ▶ queue server :8010)                 (POST ▶ Forge :7860 directly)
             │                                                │
             ▼                                                ▼
      shared queue server ──▶ Forge WebUI :7860 ──▶ writes PNG to job['output']
```

Two ways to drain the queue:
- **Direct (simplest, recommended for one-off regen):** `direct_forge_worker.py` talks
  straight to Forge on `:7860`. No queue server needed.
- **Shared queue:** `sd_queue.py worker` submits to the shared broker on `:8010` (used when
  several projects share one GPU). Optional.

## 1. Start Forge WebUI (the image backend, port 7860)

Forge lives at `C:\Users\eu01244715\workspace\StableDiffusion\forge`. The API is already
enabled in `webui\webui-user.bat` (`COMMANDLINE_ARGS=--api`).

```powershell
cd C:\Users\eu01244715\workspace\StableDiffusion\forge
.\run.bat
```

Wait until the log prints `Running on local URL:  http://127.0.0.1:7860` and a checkpoint
is selected (`Model selected: ... dreamshaper_8.safetensors`). First boot takes ~1–2 min.

Check it's up:

```powershell
(Test-NetConnection 127.0.0.1 -Port 7860).TcpTestSucceeded   # -> True
```

Leave this terminal running while you generate. Stop it with `Ctrl+C` (or close the window).

## 2. Queue the art job

Ship encyclopedia art (768×512 cinematic, one PNG per ship):

```powershell
cd C:\Users\eu01244715\workspace\ss
python scripts/generate_ship_art.py --id synth_gestalt     # one ship
python scripts/generate_ship_art.py --faction void_corsairs # one faction
python scripts/generate_ship_art.py                          # all 101 ships
python scripts/generate_ship_art.py --id synth_gestalt --dry-run  # preview prompt only
```

Output path per ship: `public/assets/ships/encyclopedia/<faction>/<ship_id>_art.png`.
This step only **queues** the job (writes `~/.sd_queue/jobs/*.pending.json`); it does not
need Forge running.

## 3. Generate (drain the queue against Forge)

```powershell
python scripts/direct_forge_worker.py            # process all pending jobs
python scripts/direct_forge_worker.py --limit 5  # first 5 only
```

Each job renders on the GPU (~30–60 s per 768×512 image on an 8 GB laptop GPU) and writes
the PNG to the job's `output` path. Re-running the game picks the new art up automatically.

## 4. Verify

```powershell
npm run dev -- --port 3003     # in one terminal
npm run verify:loop            # in another — INV-6c "asset gaps" must be "none"
```

`verify:loop` boots the game headless and asserts every ship's encyclopedia texture decodes.
A green `INV-6c asset gaps  none` confirms there are no missing images.

Audit which ships still lack art (read-only):

```powershell
$d = Get-Content scripts/ship_art_data.json -Raw | ConvertFrom-Json
$d.ships | Where-Object { -not (Test-Path "public/assets/ships/encyclopedia/$($_.faction)/$($_.id)_art.png") } | ForEach-Object { $_.id }
```

## Other asset generators (same pattern)

| Asset | Script | Output |
| --- | --- | --- |
| Ship encyclopedia art | `generate_ship_art.py` | `public/assets/ships/encyclopedia/` |
| Pilot portraits | `generate_missing_portraits.py` | `public/assets/portraits/<faction>/` |
| UI textures | `generate_ui_textures.py` | `public/sprites/ui/` |

All of them queue jobs the same way — run the generator, then `direct_forge_worker.py`.

## Music (separate service)

Music uses **Harmonia** (port 8002) + **ACE-Step** (port 8001), not Forge. See the routes in
[CLAUDE.md](../CLAUDE.md) under "Music Generation — Harmonia".

## Model / LoRA

- Checkpoint: `dreamshaper_8.safetensors` (loaded by default).
- Concept-art LoRA: `concept_art` @ 0.60 (baked into the ship-art prompts).
- Models live under `StableDiffusion\forge\webui\models\Stable-diffusion` and `...\models\Lora`.
