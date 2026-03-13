#!/usr/bin/env python3
"""
Shattered Stars - Missing Portrait Generator
Uses sd_queue.py for Forge-safe batching (multi-project coordinator aware).

Usage:
    python scripts/generate_missing_portraits.py             # command portrait only
    python scripts/generate_missing_portraits.py --talk      # + talking variants
    python scripts/generate_missing_portraits.py --all       # command + talking + regen base
    python scripts/generate_missing_portraits.py --force     # overwrite existing files
    python scripts/generate_missing_portraits.py --no-wait   # submit and exit (don't block)
"""

import argparse
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Allow running from any directory
sys.path.insert(0, str(Path(__file__).parent))
from sd_queue import submit_and_start_worker, QUEUE_DIR

PORTRAITS_DIR = Path(__file__).parent.parent / "public" / "assets" / "portraits"

# ── Model + LoRA settings ─────────────────────────────────────────────────────
# The queue worker auto-detects if checkpoint/lora should be switched.
# These match what's actually in forge/webui/models/

SDXL_CHECKPOINT = "dreamshaperXL_lightningDPMSDE.safetensors"
SD15_CHECKPOINT = "dreamshaper_8.safetensors"

# Use SD1.5 — already loaded, no reload needed
CHECKPOINT = SD15_CHECKPOINT
LORA       = "concept_art"      # available in Lora dir
LORA_W     = 0.60

NEGATIVE = (
    "text, watermark, signature, blurry, low quality, deformed, "
    "full body, anime style, multiple people, logo, frame, border"
)
TALK_SUFFIX = (
    "mouth slightly open, speaking expression, mid-sentence, natural talking pose, "
    "expressive animated face, "
)

# ── Portrait definitions ──────────────────────────────────────────────────────

PORTRAITS = {
    "portrait_command": {
        "output": PORTRAITS_DIR / "portrait_command.png",
        "prompt": (
            "military command officer, space navy command centre, "
            "headset, dark tactical holographic displays behind, "
            "authoritative stern expression, Terran Hegemony steel blue gold uniform, "
            "portrait, character art, Chris Metzen style, bold rich colors, "
            "detailed face, detailed hair, game portrait"
        ),
    },
    "portrait_admiral_chen": {
        "output": PORTRAITS_DIR / "terran_hegemony" / "admiral_chen.png",
        "prompt": (
            "Admiral Marcus Chen, stern military commander, "
            "imperial blue uniform with gold insignia, "
            "authoritative expression, space navy admiral, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_striker": {
        "output": PORTRAITS_DIR / "terran_hegemony" / "striker.png",
        "prompt": (
            "Commander Striker, veteran ace fighter pilot, "
            "battle-scarred face, flight suit, determined expression, "
            "space warfare veteran, Terran Hegemony pilot, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_whisper": {
        "output": PORTRAITS_DIR / "terran_hegemony" / "whisper.png",
        "prompt": (
            "Whisper, elite stealth pilot, dark visor helmet, "
            "shadow operative, mysterious intense expression, "
            "black tactical suit, Terran Hegemony, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
}


def build_jobs(
    keys: list[str],
    talking: bool = False,
    force: bool = False,
) -> list[dict]:
    jobs = []
    for key in keys:
        spec = PORTRAITS[key]

        base_out = spec["output"]
        if talking and key != "portrait_command":
            out = base_out.with_name(base_out.stem + "_talk" + base_out.suffix)
            prompt = TALK_SUFFIX + spec["prompt"]
        else:
            out = base_out
            prompt = spec["prompt"]

        if out.exists() and not force:
            print(f"  [SKIP] {out.name} (exists — use --force to regenerate)")
            continue

        jobs.append({
            "id":         f"{key}{'_talk' if talking else ''}",
            "project":    "shattered-stars",
            "checkpoint": CHECKPOINT,
            "lora":       LORA,
            "lora_weight": LORA_W,
            "prompt":     prompt,
            "negative":   NEGATIVE,
            "width":      512,
            "height":     768,
            "steps":      25,
            "cfg":        7.0,
            "sampler":    "DPM++ 2M Karras",
            "seed":       -1,
            "output":     str(out.resolve()),
        })
    return jobs


def main():
    parser = argparse.ArgumentParser(description="Generate missing Shattered Stars portraits")
    parser.add_argument("--talk",     action="store_true", help="Also generate talking variants")
    parser.add_argument("--all",      action="store_true", help="Generate everything (incl. regen base portraits)")
    parser.add_argument("--force",    action="store_true", help="Overwrite existing files")
    parser.add_argument("--no-wait",  action="store_true", help="Submit jobs and exit without waiting")
    args = parser.parse_args()

    if args.all:
        args.talk = True

    jobs: list[dict] = []

    # Always include command portrait
    jobs += build_jobs(["portrait_command"], talking=False, force=args.force)

    # If --all, regen base pilot portraits too
    if args.all:
        pilot_keys = ["portrait_admiral_chen", "portrait_striker", "portrait_whisper"]
        jobs += build_jobs(pilot_keys, talking=False, force=args.force)

    # Talking variants
    if args.talk:
        pilot_keys = ["portrait_admiral_chen", "portrait_striker", "portrait_whisper"]
        jobs += build_jobs(pilot_keys, talking=True, force=args.force)

    if not jobs:
        print("No jobs to run (all files already exist). Use --force to regenerate.")
        return

    # ── All jobs share the same checkpoint+lora so the worker processes them
    #    in one batch with zero model reloads.
    print(f"\nSubmitting {len(jobs)} job(s) to sd_queue (queued at {QUEUE_DIR})")
    print(f"  checkpoint : {CHECKPOINT}")
    print(f"  lora       : {LORA} @ {LORA_W}")
    print()
    for j in jobs:
        print(f"  -> {Path(j['output']).name}")
    print()

    if args.no_wait:
        from sd_queue import submit, QUEUE_DIR as QD
        QD.mkdir(parents=True, exist_ok=True)
        ids = submit(jobs)
        print(f"Submitted {len(ids)} job(s). Run `python scripts/sd_queue.py worker` to process.")
        print("  or: python scripts/sd_queue.py status")
    else:
        results = submit_and_start_worker(jobs, wait=True)
        successes = sum(1 for v in results.values() if v == "done")
        failures  = sum(1 for v in results.values() if v == "failed")
        print(f"\nDone: {successes} OK, {failures} failed")
        if failures:
            failed_ids = [k for k, v in results.items() if v == "failed"]
            print(f"  Failed IDs: {failed_ids}")
            print(f"  Check: {QUEUE_DIR}")

        if successes > 0:
            print("\nPortraits written. Restart Vite dev server to pick up new images.")
            if args.talk:
                print("\nNext step — wire talking animation:")
                print("  The DebriefScene can be updated to play frames 0/1 during typewriter.")
                print("  Let Claude know when you're ready for that step.")


if __name__ == "__main__":
    main()
