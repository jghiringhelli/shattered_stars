#!/usr/bin/env python3
"""
sd_queue.py — Stable Diffusion generation via shared queue server

All generation requests are sent to the shared SD queue server at
http://127.0.0.1:8010 (never directly to Forge).

POST /jobs   { project, endpoint, priority, payload }  -> { job_id }
GET  /jobs/{job_id}                                    -> { status, result, error }

Local file queue in ~/.sd_queue/jobs/ tracks per-project job lifecycle so
multiple scripts can batch-submit without overwriting each other's outputs.

Job file states (encoded in filename):
  <timestamp>_<id>.pending.json   -> waiting to be submitted to server
  <timestamp>_<id>.running.json   -> submitted to server, polling
  <timestamp>_<id>.done.json      -> output PNG written
  <timestamp>_<id>.failed.json    -> error (see job['error'])

Usage:
  python sd_queue.py submit JOBS_FILE.json      # queue jobs from file
  python sd_queue.py worker                      # run worker loop (foreground)
  python sd_queue.py worker --once               # drain queue once and exit
  python sd_queue.py status                      # print queue summary
  python sd_queue.py wait JOB_ID [JOB_ID ...]   # block until jobs finish
  python sd_queue.py clear --done                # remove done/failed job files

Job JSON format (single job or list):
  {
    "id":           "optional-unique-id",
    "project":      "shattered-stars",
    "checkpoint":   "dreamshaper_8.safetensors",   // null = server default
    "lora":         "concept_art",                  // null = no lora
    "lora_weight":  0.60,
    "prompt":       "...",
    "negative":     "...",
    "width":        512,
    "height":       768,
    "steps":        25,
    "cfg":          7.0,
    "sampler":      "DPM++ 2M Karras",
    "seed":         -1,
    "output":       "/abs/path/to/output.png"       // REQUIRED
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

# Ensure UTF-8 output on Windows (avoids cp1252 errors)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ── Configuration ────────────────────────────────────────────────────────────

SD_QUEUE_API  = "http://127.0.0.1:8010"   # shared queue server (never direct Forge)
QUEUE_DIR     = Path.home() / ".sd_queue" / "jobs"
LOCK_FILE     = Path.home() / ".sd_queue" / "WORKER.lock"
POLL_INTERVAL = 2    # seconds between local queue polls
JOB_POLL_SEC  = 2    # seconds between server job status polls
JOB_TIMEOUT   = 600  # seconds before giving up on a single generation

# ── Job file helpers ──────────────────────────────────────────────────────────

def make_job_id() -> str:
    return uuid.uuid4().hex[:12]

def job_path(job_id: str, state: str) -> Path:
    for f in QUEUE_DIR.glob(f"*_{job_id}.*.json"):
        return f
    ts = int(time.time() * 1000)
    return QUEUE_DIR / f"{ts:016d}_{job_id}.{state}.json"

def job_state(path: Path) -> str:
    parts = path.stem.split(".")
    return parts[-1] if len(parts) >= 2 else "unknown"

def job_id_from_path(path: Path) -> str:
    stem_base = path.name.split(".")[0]
    return stem_base.split("_", 1)[1]

def transition(path: Path, new_state: str) -> Path:
    """Atomically rename a job file to a new state."""
    stem_base = path.name.split(".")[0]
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
    """Return (path, job) pairs sorted by filename (FIFO order)."""
    jobs = []
    for f in sorted(QUEUE_DIR.glob("*.pending.json")):
        try:
            jobs.append((f, read_job(f)))
        except Exception:
            pass
    return jobs

# ── Submitting local jobs ─────────────────────────────────────────────────────

def submit(job_or_list) -> list[str]:
    """Write one or more jobs to the local queue. Returns list of job IDs."""
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
        print(f"  Queued {job['id']} -> {Path(job['output']).name}")
    return ids

# ── SD Queue Server API ───────────────────────────────────────────────────────

def generate(job: dict) -> Optional[bytes]:
    """
    Submit one generation job to the shared SD queue server and return PNG bytes.
    Blocks until the server reports succeeded or failed (up to JOB_TIMEOUT seconds).
    """
    lora   = job.get("lora")
    lora_w = job.get("lora_weight", 0.8)
    prompt = (f"<lora:{lora}:{lora_w}> " if lora else "") + job["prompt"]

    forge_payload: dict = {
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
    # Pass checkpoint as an override so the server can handle model switching
    if job.get("checkpoint"):
        forge_payload["override_settings"] = {
            "sd_model_checkpoint": job["checkpoint"]
        }
        forge_payload["override_settings_restore_afterwards"] = False

    submission = {
        "project":  job.get("project", "shattered-stars"),
        "endpoint": "/sdapi/v1/txt2img",
        "priority": 5,
        "payload":  forge_payload,
    }

    # Submit to the shared queue server
    try:
        r = requests.post(f"{SD_QUEUE_API}/jobs", json=submission, timeout=10)
        r.raise_for_status()
        server_job_id = r.json()["job_id"]
    except Exception as e:
        print(f"      submit error: {e}")
        return None

    # Poll until the server completes the job
    deadline = time.time() + JOB_TIMEOUT
    while time.time() < deadline:
        try:
            r = requests.get(f"{SD_QUEUE_API}/jobs/{server_job_id}", timeout=5)
            r.raise_for_status()
            data = r.json()
            status = data.get("status")
            if status == "succeeded":
                images = data.get("result", {}).get("images", [])
                return base64.b64decode(images[0]) if images else None
            if status == "failed":
                print(f"      server job failed: {data.get('error', 'unknown')}")
                return None
        except Exception as e:
            print(f"      poll error: {e}")
        time.sleep(JOB_POLL_SEC)

    print("      timeout waiting for server")
    return None

# ── Worker process ────────────────────────────────────────────────────────────

def acquire_worker_lock() -> bool:
    """Returns True if this process became the worker; False if one already runs."""
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    if LOCK_FILE.exists():
        try:
            pid = int(LOCK_FILE.read_text().strip())
            os.kill(pid, 0)   # signal 0 = existence check
            return False
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
    Submit all pending local jobs to the SD queue server, writing output PNGs.
    Returns number of jobs successfully completed.
    """
    pending = load_pending_jobs()
    if not pending:
        return 0

    print(f"\n  Submitting {len(pending)} job(s) to {SD_QUEUE_API}")
    processed = 0

    for path, job in pending:
        jid = job["id"]
        out = Path(job["output"])
        print(f"    [{jid}] {out.name} ...", end=" ", flush=True)

        # Claim the job (rename .pending -> .running)
        try:
            running_path = transition(path, "running")
        except FileNotFoundError:
            print("stolen (another worker took it)")
            continue

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
        print(f"Server: {SD_QUEUE_API}")
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
                rows[st].append(
                    f"    {job.get('id','?')[:10]}  "
                    f"{Path(job.get('output','?')).name}  "
                    f"[{job.get('project','')}]"
                )
            except Exception:
                rows[st].append(f"    (unreadable) {f.name}")

    worker_pid = LOCK_FILE.read_text().strip() if LOCK_FILE.exists() else None
    print(f"\n=== SD Queue Status ({'worker PID ' + worker_pid if worker_pid else 'no worker'}) ===")
    print(f"  pending: {counts['pending']}  running: {counts['running']}  "
          f"done: {counts['done']}  failed: {counts['failed']}")
    for st in ("running", "pending", "failed"):
        if rows[st]:
            print(f"\n  {st.upper()}:")
            print("\n".join(rows[st]))
    print()

def wait_for_jobs(job_ids: list[str], timeout: float = 600) -> dict[str, str]:
    """
    Block until all specified job IDs reach done/failed in the local queue.
    Returns {job_id: 'done'|'failed'|'timeout'}.
    """
    deadline = time.time() + timeout
    remaining = set(job_ids)
    results: dict[str, str] = {}
    print(f"Waiting for {len(job_ids)} job(s)...", end=" ", flush=True)

    while remaining and time.time() < deadline:
        for jid in list(remaining):
            for state in ("done", "failed"):
                if list(QUEUE_DIR.glob(f"*_{jid}.{state}.json")):
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

# ── High-level library helper ─────────────────────────────────────────────────

def submit_and_start_worker(jobs: list[dict], wait: bool = True) -> dict[str, str]:
    """
    Submit jobs to the local queue, then start/join a worker thread.
    If another worker is already running, just submit and optionally wait.

    Usage from other scripts:
        from sd_queue import submit_and_start_worker
        results = submit_and_start_worker(my_jobs, wait=True)
    """
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    ids = submit(jobs)

    if acquire_worker_lock():
        release_worker_lock()   # release so run_worker() can re-acquire
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
    parser = argparse.ArgumentParser(description="SD queue client (routes via :8010)")
    sub = parser.add_subparsers(dest="cmd")

    p_sub = sub.add_parser("submit", help="Queue jobs from a JSON file")
    p_sub.add_argument("file", help="JSON file with a job or list of jobs")
    p_sub.add_argument("--wait",   action="store_true", help="Block until jobs complete")
    p_sub.add_argument("--worker", action="store_true", help="Start worker if none running")

    p_wrk = sub.add_parser("worker", help="Run the queue worker")
    p_wrk.add_argument("--once", action="store_true", help="Drain once and exit")

    sub.add_parser("status", help="Show local queue state")

    p_wait = sub.add_parser("wait", help="Wait for specific job IDs")
    p_wait.add_argument("ids", nargs="+")
    p_wait.add_argument("--timeout", type=float, default=600)

    p_clr = sub.add_parser("clear", help="Remove local job files")
    p_clr.add_argument("--done", action="store_true", help="Remove done + failed jobs")
    p_clr.add_argument("--all",  action="store_true", help="Remove ALL job files")

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
