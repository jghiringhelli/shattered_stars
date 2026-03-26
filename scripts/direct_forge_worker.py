#!/usr/bin/env python3
"""
direct_forge_worker.py — Process pending SD queue jobs by submitting
directly to Forge at http://127.0.0.1:7860 (bypasses the 8010 queue server).

Usage:
  python scripts/direct_forge_worker.py           # process all pending jobs
  python scripts/direct_forge_worker.py --limit N # process first N jobs
"""
import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

FORGE_URL   = "http://127.0.0.1:7860"
QUEUE_DIR   = Path.home() / ".sd_queue" / "jobs"
JOB_TIMEOUT = 300


def submit_to_forge(job: dict) -> bytes | None:
    lora   = job.get("lora")
    lora_w = job.get("lora_weight", 0.8)
    prompt = (f"<lora:{lora}:{lora_w}> " if lora else "") + job["prompt"]

    payload: dict = {
        "prompt":          prompt,
        "negative_prompt": job.get("negative", ""),
        "width":           job.get("width", 512),
        "height":          job.get("height", 768),
        "steps":           job.get("steps", 25),
        "cfg_scale":       job.get("cfg", 7.0),
        "sampler_name":    job.get("sampler", "DPM++ 2M Karras"),
        "seed":            job.get("seed", -1),
        "batch_size":      1,
    }
    if job.get("checkpoint"):
        payload["override_settings"] = {"sd_model_checkpoint": job["checkpoint"]}
        payload["override_settings_restore_afterwards"] = False

    try:
        r = requests.post(f"{FORGE_URL}/sdapi/v1/txt2img", json=payload, timeout=JOB_TIMEOUT)
        r.raise_for_status()
        images = r.json().get("images", [])
        return base64.b64decode(images[0]) if images else None
    except Exception as e:
        print(f"  Forge error: {e}")
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Max jobs to process (0=all)")
    args = parser.parse_args()

    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    pending = sorted(QUEUE_DIR.glob("*.pending.json"))
    if not pending:
        print("No pending jobs.")
        return

    total = len(pending)
    limit = args.limit if args.limit > 0 else total
    print(f"Processing {min(limit, total)}/{total} pending jobs via Forge at {FORGE_URL}\n")

    done = 0
    for job_file in pending[:limit]:
        job = json.loads(job_file.read_text(encoding="utf-8"))
        output = job.get("output", "")
        label  = job.get("id", job_file.stem)
        print(f"[{done+1}/{min(limit,total)}] {label} → {Path(output).name} ...", end=" ", flush=True)

        # Skip if output already exists
        if output and Path(output).exists():
            print("SKIP (exists)")
            job_file.rename(job_file.with_name(job_file.name.replace('.pending.json', '.done.json')))
            done += 1
            continue

        png = submit_to_forge(job)
        if png:
            os.makedirs(Path(output).parent, exist_ok=True)
            Path(output).write_bytes(png)
            job_file.rename(job_file.with_name(job_file.name.replace('.pending.json', '.done.json')))
            print("OK")
        else:
            job_file.rename(job_file.with_name(job_file.name.replace('.pending.json', '.failed.json')))
            print("FAILED")
        done += 1

    print(f"\nDone: {done} jobs processed.")


if __name__ == "__main__":
    main()
