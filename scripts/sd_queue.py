#!/usr/bin/env python3
"""
sd_queue.py — Stable Diffusion Forge batching queue (multi-project safe)

Shared queue directory: ~/.sd_queue/  (all projects on this machine share it)

Job files are individual JSONs; state encoded in filename suffix:
  <timestamp>_<id>.pending.json   → waiting
  <timestamp>_<id>.running.json   → being generated (by this or another worker)
  <timestamp>_<id>.done.json      → complete (output PNG written)
  <timestamp>_<id>.failed.json    → error (see job['error'])

Usage:
  python sd_queue.py submit JOBS_FILE.json      # queue a list of jobs from file
  python sd_queue.py worker                      # run the worker loop (foreground)
  python sd_queue.py worker --once               # drain queue once and exit
  python sd_queue.py status                      # print queue summary
  python sd_queue.py wait JOB_ID [JOB_ID ...]   # block until specific jobs finish
  python sd_queue.py clear --done                # remove done/failed job files

Job JSON format (single job or list of jobs):
  {
    "id":           "optional-unique-id",   // auto-generated uuid4 if absent
    "project":      "shattered-stars",      // optional label
    "checkpoint":   "dreamshaper_8.safetensors",  // null = keep current model
    "lora":         "StainedGlassPortrait_SDXL",  // null = no lora
    "lora_weight":  0.75,
    "prompt":       "...",
    "negative":     "...",
    "width":        512,
    "height":       768,
    "steps":        25,
    "cfg":          7.0,
    "sampler":      "DPM++ 2M Karras",
    "seed":         -1,
    "output":       "/abs/path/to/output.png"  // REQUIRED
  }
"""

import argparse
import base64
import json
import os
import signal
import sys
import time
import uuid
from pathlib import Path
from typing import Optional

import requests

# Ensure UTF-8 output on Windows (avoids cp1252 errors with box-drawing / arrows)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ── Configuration ────────────────────────────────────────────────────────────

FORGE_API    = "http://127.0.0.1:7860"
QUEUE_DIR    = Path.home() / ".sd_queue" / "jobs"
LOCK_FILE    = Path.home() / ".sd_queue" / "WORKER.lock"
POLL_INTERVAL = 2   # seconds between queue polls in worker loop
BUSY_WAIT     = 5   # seconds to wait when Forge is busy

# ── Job helpers ───────────────────────────────────────────────────────────────

def make_job_id() -> str:
    return uuid.uuid4().hex[:12]

def job_path(job_id: str, state: str) -> Path:
    # Find existing file for this job regardless of timestamp
    for f in QUEUE_DIR.glob(f"*_{job_id}.*.json"):
        return f
    # New file: timestamp prefix keeps natural sort = FIFO order
    ts = int(time.time() * 1000)
    return QUEUE_DIR / f"{ts:016d}_{job_id}.{state}.json"

def job_state(path: Path) -> str:
    # State encoded as second-to-last path component: name.STATE.json
    parts = path.stem.split(".")
    return parts[-1] if len(parts) >= 2 else "unknown"

def job_id(path: Path) -> str:
    # Filename format: <ts>_<id>.<state>.json
    stem_base = path.name.split(".")[0]       # "0123456789_abc123"
    return stem_base.split("_", 1)[1]         # "abc123"

def transition(path: Path, new_state: str) -> Path:
    """Atomically rename a job file to new_state."""
    stem_base = path.name.split(".")[0]   # timestamp_id
    new_path = path.parent / f"{stem_base}.{new_state}.json"
    path.rename(new_path)
    return new_path

def read_job(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)

def write_job(path: Path, job: dict) -> None:
    with open(path, "w") as f:
        json.dump(job, f, indent=2)

def load_pending_jobs() -> list[tuple[Path, dict]]:
    """Return list of (path, job) sorted by filename (= submission time)."""
    jobs = []
    for f in sorted(QUEUE_DIR.glob("*.pending.json")):
        try:
            jobs.append((f, read_job(f)))
        except Exception:
            pass  # skip corrupt files
    return jobs

# ── Submitting jobs ───────────────────────────────────────────────────────────

def submit(job_or_list) -> list[str]:
    """Write one or more jobs to the queue. Returns list of job IDs."""
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    jobs = job_or_list if isinstance(job_or_list, list) else [job_or_list]
    ids = []
    for job in jobs:
        if "id" not in job:
            job["id"] = make_job_id()
        if "output" not in job:
            raise ValueError(f"Job missing required 'output' field: {job}")
        path = job_path(job["id"], "pending")
        write_job(path, job)
        ids.append(job["id"])
        print(f"  Queued {job['id']} → {Path(job['output']).name}")
    return ids

# ── Forge API helpers ─────────────────────────────────────────────────────────

def is_forge_idle() -> bool:
    try:
        r = requests.get(f"{FORGE_API}/sdapi/v1/progress", timeout=3)
        return r.json().get("state", {}).get("job_count", 1) == 0
    except Exception:
        return False

def get_current_model() -> str:
    try:
        r = requests.get(f"{FORGE_API}/sdapi/v1/options", timeout=5)
        return r.json().get("sd_model_checkpoint", "")
    except Exception:
        return ""

def set_model(checkpoint: str) -> None:
    print(f"    [reload] Loading checkpoint: {checkpoint} ...", end=" ", flush=True)
    try:
        requests.post(f"{FORGE_API}/sdapi/v1/options",
                      json={"sd_model_checkpoint": checkpoint}, timeout=10)
        # Wait until Forge reports idle + model matches
        for _ in range(120):   # up to 4 min
            time.sleep(2)
            if get_current_model() == checkpoint and is_forge_idle():
                break
        print("done")
    except Exception as e:
        print(f"failed: {e}")

def generate(job: dict) -> Optional[bytes]:
    """Send txt2img request and return raw PNG bytes, or None on failure."""
    lora      = job.get("lora")
    lora_w    = job.get("lora_weight", 0.8)
    prompt    = (f"<lora:{lora}:{lora_w}> " if lora else "") + job["prompt"]
    negative  = job.get("negative", "")

    payload = {
        "prompt":          prompt,
        "negative_prompt": negative,
        "width":           job.get("width", 512),
        "height":          job.get("height", 768),
        "steps":           job.get("steps", 25),
        "cfg_scale":       job.get("cfg", 7.0),
        "sampler_name":    job.get("sampler", "DPM++ 2M Karras"),
        "seed":            job.get("seed", -1),
        "batch_size":      1,
    }
    try:
        r = requests.post(f"{FORGE_API}/sdapi/v1/txt2img", json=payload, timeout=300)
        if r.status_code == 200:
            images = r.json().get("images", [])
            return base64.b64decode(images[0]) if images else None
        print(f"      API {r.status_code}")
        return None
    except Exception as e:
        print(f"      {e}")
        return None

# ── Worker process ────────────────────────────────────────────────────────────

def acquire_worker_lock() -> bool:
    """Returns True if we became the worker, False if another worker is running."""
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    if LOCK_FILE.exists():
        try:
            pid = int(LOCK_FILE.read_text().strip())
            # Check if that PID is still alive (Windows-compatible)
            os.kill(pid, 0)   # signal 0 = existence check
            return False       # still alive → another worker running
        except (OSError, ProcessLookupError, ValueError):
            pass  # stale lock — take it
    LOCK_FILE.write_text(str(os.getpid()))
    return True

def release_worker_lock() -> None:
    try:
        LOCK_FILE.unlink(missing_ok=True)
    except Exception:
        pass

def drain_queue() -> int:
    """
    Process all pending jobs, batched by checkpoint→lora to minimize reloads.
    Returns number of jobs processed.
    """
    pending = load_pending_jobs()
    if not pending:
        return 0

    # ── Sort by (checkpoint, lora) to group compatible jobs ──────────────────
    def sort_key(item):
        _, job = item
        return (job.get("checkpoint") or "", job.get("lora") or "")

    pending.sort(key=sort_key)

    # ── Group by checkpoint ───────────────────────────────────────────────────
    from itertools import groupby
    processed = 0
    current_model = get_current_model()

    for checkpoint, ck_group in groupby(pending, key=lambda x: x[1].get("checkpoint") or ""):
        ck_jobs = list(ck_group)

        # Switch checkpoint if needed
        target_ck = checkpoint or current_model
        if target_ck and target_ck != current_model:
            set_model(target_ck)
            current_model = target_ck

        # Sub-group by lora (within same checkpoint, lora switch is zero-cost)
        for lora, lora_group in groupby(ck_jobs, key=lambda x: x[1].get("lora") or ""):
            lora_jobs = list(lora_group)
            lora_label = f"LoRA={lora}" if lora else "no LoRA"
            print(f"\n  [{lora_label}] {len(lora_jobs)} job(s)")

            for path, job in lora_jobs:
                jid = job["id"]
                out = Path(job["output"])
                print(f"    [{jid}] {out.name} ...", end=" ", flush=True)

                # Claim the job (rename .pending → .running)
                try:
                    running_path = transition(path, "running")
                except FileNotFoundError:
                    print("stolen (another worker took it)")
                    continue

                # Wait for Forge if it's busy (another project may be using it)
                for attempt in range(60):
                    if is_forge_idle():
                        break
                    if attempt == 0:
                        print(f"\n      Forge busy, waiting...", end=" ", flush=True)
                    time.sleep(BUSY_WAIT)
                else:
                    print("timeout")
                    job["error"] = "Forge stayed busy for 5 minutes"
                    write_job(running_path, job)
                    transition(running_path, "failed")
                    continue

                # Generate
                data = generate(job)
                if data:
                    out.parent.mkdir(parents=True, exist_ok=True)
                    out.write_bytes(data)
                    job["completed_at"] = time.time()
                    write_job(running_path, job)
                    transition(running_path, "done")
                    print("OK")
                    processed += 1
                else:
                    job["error"] = "generate() returned None"
                    write_job(running_path, job)
                    transition(running_path, "failed")
                    print("FAILED")

    return processed

def run_worker(once: bool = False) -> None:
    if not acquire_worker_lock():
        print(f"Another worker is already running (see {LOCK_FILE})")
        if not once:
            print("Becoming a submitter-only process.")
        return

    def _cleanup(sig=None, frame=None):
        release_worker_lock()
        sys.exit(0)

    import threading
    if threading.current_thread() is threading.main_thread():
        signal.signal(signal.SIGINT,  _cleanup)
        signal.signal(signal.SIGTERM, _cleanup)

    try:
        print(f"Worker PID {os.getpid()} started. Queue: {QUEUE_DIR}")
        while True:
            n = drain_queue()
            if n:
                print(f"\n  Processed {n} job(s). Polling...")
            if once:
                print("--once: exiting after queue drain.")
                break
            time.sleep(POLL_INTERVAL)
    finally:
        release_worker_lock()

# ── Status / wait ─────────────────────────────────────────────────────────────

def print_status() -> None:
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    counts = {"pending": 0, "running": 0, "done": 0, "failed": 0}
    rows   = {"pending": [], "running": [], "failed": []}

    for f in sorted(QUEUE_DIR.glob("*.*.json")):
        st = job_state(f)
        counts[st] = counts.get(st, 0) + 1
        if st in rows:
            try:
                job = read_job(f)
                rows[st].append(f"    {job.get('id','?')[:10]}  {Path(job.get('output','?')).name}  [{job.get('project','')}]")
            except Exception:
                rows[st].append(f"    (unreadable) {f.name}")

    worker_pid = LOCK_FILE.read_text().strip() if LOCK_FILE.exists() else None
    print(f"\n=== SD Queue Status ({'worker PID ' + worker_pid if worker_pid else 'no worker'}) ===")
    print(f"  pending: {counts['pending']}  running: {counts['running']}  done: {counts['done']}  failed: {counts['failed']}")
    for st in ("running", "pending", "failed"):
        if rows[st]:
            print(f"\n  {st.upper()}:")
            print("\n".join(rows[st]))
    print()

def wait_for_jobs(job_ids: list[str], timeout: float = 600) -> dict[str, str]:
    """
    Block until all specified job IDs reach done/failed.
    Returns {job_id: 'done'|'failed'} mapping.
    """
    deadline = time.time() + timeout
    remaining = set(job_ids)
    results = {}
    print(f"Waiting for {len(job_ids)} job(s)...", end=" ", flush=True)

    while remaining and time.time() < deadline:
        for jid in list(remaining):
            # Check for any file matching this job id in done/failed state
            for state in ("done", "failed"):
                matches = list(QUEUE_DIR.glob(f"*_{jid}.{state}.json"))
                if matches:
                    results[jid] = state
                    remaining.discard(jid)
                    print(f"{state}({jid[:6]})", end=" ", flush=True)
                    break
        if remaining:
            time.sleep(POLL_INTERVAL)

    if remaining:
        for jid in remaining:
            results[jid] = "timeout"
        print(f"TIMEOUT for: {remaining}")
    else:
        print("all done.")
    return results

# ── Helper for scripts to use as a library ────────────────────────────────────

def submit_and_start_worker(jobs: list[dict], wait: bool = True) -> dict[str, str]:
    """
    High-level helper: submit jobs, then become the worker if none is running.
    If another worker is running, just submit and optionally wait.

    Usage in other scripts:
        from sd_queue import submit_and_start_worker
        results = submit_and_start_worker(my_jobs, wait=True)
    """
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    ids = submit(jobs)

    if acquire_worker_lock():
        release_worker_lock()   # release so run_worker() can re-acquire properly
        import threading
        t = threading.Thread(target=run_worker, kwargs={"once": True}, daemon=True)
        t.start()
        if wait:
            results = wait_for_jobs(ids)
            t.join(timeout=5)
            return results
        t.join()
        return {jid: "submitted" for jid in ids}
    else:
        print("Worker already running — jobs submitted to queue.")
        if wait:
            return wait_for_jobs(ids)
        return {jid: "submitted" for jid in ids}

# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="SD Forge batching queue")
    sub = parser.add_subparsers(dest="cmd")

    # submit
    p_sub = sub.add_parser("submit", help="Queue jobs from a JSON file")
    p_sub.add_argument("file", help="JSON file with a job or list of jobs")
    p_sub.add_argument("--wait", action="store_true", help="Block until jobs complete")
    p_sub.add_argument("--worker", action="store_true", help="Also start worker if none running")

    # worker
    p_wrk = sub.add_parser("worker", help="Run the queue worker")
    p_wrk.add_argument("--once", action="store_true", help="Drain once and exit")

    # status
    sub.add_parser("status", help="Show queue state")

    # wait
    p_wait = sub.add_parser("wait", help="Wait for specific job IDs")
    p_wait.add_argument("ids", nargs="+")
    p_wait.add_argument("--timeout", type=float, default=600)

    # clear
    p_clr = sub.add_parser("clear", help="Remove job files")
    p_clr.add_argument("--done",   action="store_true", help="Remove done + failed jobs")
    p_clr.add_argument("--all",    action="store_true", help="Remove ALL job files")

    args = parser.parse_args()

    if args.cmd == "submit":
        with open(args.file) as f:
            data = json.load(f)
        QUEUE_DIR.mkdir(parents=True, exist_ok=True)
        ids = submit(data)
        if args.worker or args.wait:
            if not acquire_worker_lock():
                print("Worker already running.")
            else:
                release_worker_lock()
                if args.wait:
                    run_worker(once=True)
                    wait_for_jobs(ids)
                else:
                    import subprocess
                    subprocess.Popen([sys.executable, __file__, "worker", "--once"])
                    print("Worker launched in background.")

    elif args.cmd == "worker":
        run_worker(once=getattr(args, "once", False))

    elif args.cmd == "status":
        print_status()

    elif args.cmd == "wait":
        results = wait_for_jobs(args.ids, args.timeout)
        for jid, st in results.items():
            print(f"  {jid}: {st}")

    elif args.cmd == "clear":
        QUEUE_DIR.mkdir(parents=True, exist_ok=True)
        removed = 0
        for f in QUEUE_DIR.glob("*.*.json"):
            st = job_state(f)
            if args.all or (args.done and st in ("done", "failed")):
                f.unlink()
                removed += 1
        print(f"Removed {removed} job file(s).")

    else:
        parser.print_help()

if __name__ == "__main__":
    main()
