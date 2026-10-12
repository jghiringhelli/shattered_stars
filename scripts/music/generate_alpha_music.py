#!/usr/bin/env python3
"""generate_alpha_music.py — Render the alpha music set with ACE-Step and
integrate it into the game (public/assets/audio/music/<id>.ogg|.mp3).

Pipeline per track (spec: scripts/music/alpha_tracks.json):
  1. Save Harmonia's composition prompt for the faction/mood (provenance).
  2. POST the curated tag prompt + seed to the ACE-Step adapter (:8001).
  3. QA the raw render (length, silence, clipping); on failure retry with
     seed + RETRY_SEED_STEP (the used seed is recorded in the report).
  4. Retune (Ascendant: A=432), cut lead-in/fade-out, fold into a seamless loop.
  5. Static gain to -16 LUFS (+ limiter if true peak would pass -1.5 dBTP),
     encode Vorbis q1 + MP3 96k.

Prerequisites: Harmonia on :8002 and the ACE-Step adapter on :8001
(see CLAUDE.md "Music Generation — Harmonia"), ffmpeg/ffprobe on PATH.

Usage:
  python -B scripts/music/generate_alpha_music.py                 # all tracks
  python -B scripts/music/generate_alpha_music.py --only heg_combat --seed 99
  python -B scripts/music/generate_alpha_music.py --reencode      # re-run 4-5 from saved raw renders
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True  # never leave __pycache__ in the repo (Vite watcher)

import argparse
import json
import time
import urllib.request
from pathlib import Path

import music_post as post

REPO_ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = Path(__file__).with_name("alpha_tracks.json")
GAME_MUSIC_DIR = REPO_ROOT / "public" / "assets" / "audio" / "music"
DEFAULT_MASTERS_DIR = Path.home() / "workspace" / "harmonia" / "output" / "shattered_stars" / "alpha"
HARMONIA_URL = "http://127.0.0.1:8002"
ACE_STEP_URL = "http://127.0.0.1:8001"
GENERATION_TIMEOUT_SECONDS = 1800
MAX_ATTEMPTS = 3
RETRY_SEED_STEP = 1000
SPARSE_ERAS = {"ascendant"}


def _post_json(url: str, body: dict[str, object], timeout: float) -> dict[str, object]:
    request = urllib.request.Request(url, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def save_composition_prompt(track: dict, masters: Path) -> None:
    """Store Harmonia's paste-ready composition prompt next to the master."""
    if not track.get("harmonia_era"):
        return
    body = {"era_id": track["harmonia_era"], "mood": track["harmonia_mood"],
            "duration_minutes": track["duration_seconds"] / 60,
            "additional_context": "Shattered Stars alpha: real-time arcade space combat; seamless loop"}
    result = _post_json(f"{HARMONIA_URL}/projects/shattered_stars/prompts/composition", body, 60)
    (masters / f"{track['id']}.composition.txt").write_text(str(result["prompt"]), encoding="utf-8")


def render(track: dict, seed: int, defaults: dict, raw_path: Path) -> float:
    """Ask ACE-Step for one render and download it; returns elapsed seconds."""
    started = time.time()
    body = {"prompt": track["prompt"], "seed": seed, "format": "wav",
            "duration": track["duration_seconds"] + defaults["generation_margin_seconds"],
            "infer_step": defaults["infer_step"], "guidance_scale": defaults["guidance_scale"],
            "lyrics": "[instrumental]"}
    result = _post_json(f"{ACE_STEP_URL}/generate", body, GENERATION_TIMEOUT_SECONDS)
    with urllib.request.urlopen(str(result["audio_url"]), timeout=300) as response:
        raw_path.write_bytes(response.read())
    return time.time() - started


def generate_raw(track: dict, defaults: dict, masters: Path, seed: int) -> tuple[Path, int, list]:
    """Render until QA passes or attempts run out; returns (raw path, seed, attempt log)."""
    attempts: list[dict[str, object]] = []
    sparse = track.get("harmonia_era") in SPARSE_ERAS
    for attempt in range(MAX_ATTEMPTS):
        candidate_seed = seed + attempt * RETRY_SEED_STEP
        raw = masters / "raw" / f"{track['id']}_s{candidate_seed}.wav"
        raw.parent.mkdir(parents=True, exist_ok=True)
        elapsed = render(track, candidate_seed, defaults, raw)
        qa = post.analyse(raw, track["duration_seconds"], sparse)
        attempts.append({"seed": candidate_seed, "seconds": round(elapsed), **post.report_dict(qa)})
        print(f"  seed {candidate_seed}: {elapsed:.0f}s render, problems={list(qa.problems)}", flush=True)
        if not qa.problems:
            return raw, candidate_seed, attempts
    raise RuntimeError(f"{track['id']}: all {MAX_ATTEMPTS} renders failed QA: {attempts}")


def finish(track: dict, defaults: dict, masters: Path, raw: Path) -> dict[str, object]:
    """Retune, loop, normalise and encode one raw render into the game folder."""
    work = masters / "work"
    work.mkdir(parents=True, exist_ok=True)
    tuned = raw
    if track["tuning_hz"] != post.REFERENCE_TUNING_HZ:
        tuned = work / f"{track['id']}_tuned.wav"
        post.retune(raw, tuned, track["tuning_hz"])
    looped = work / f"{track['id']}_loop.wav"
    loop_seconds, seam_similarity = post.make_seamless_loop(
        tuned, looped, track["duration_seconds"], defaults["loop_crossfade_seconds"],
        None, defaults["loop_start_search_seconds"])
    master = masters / f"{track['id']}.wav"
    mastered = post.master_and_encode(looped, master, GAME_MUSIC_DIR, track["id"])
    return {"loop_seconds": round(loop_seconds, 2), "seam_similarity": seam_similarity,
            **mastered}


def _existing_raw(masters: Path, track_id: str, seed: int) -> Path:
    candidates = sorted((masters / "raw").glob(f"{track_id}_s*.wav"),
                        key=lambda p: p.stat().st_mtime)
    exact = masters / "raw" / f"{track_id}_s{seed}.wav"
    if exact.exists():
        return exact
    if not candidates:
        raise FileNotFoundError(f"No raw render for {track_id} in {masters / 'raw'}")
    return candidates[-1]


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--only", nargs="*", help="track ids to process")
    parser.add_argument("--seed", type=int, help="override the spec seed (with --only)")
    parser.add_argument("--reencode", action="store_true", help="skip rendering; reuse raw renders")
    parser.add_argument("--masters-dir", type=Path, default=DEFAULT_MASTERS_DIR)
    args = parser.parse_args()
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    tracks = [t for t in spec["tracks"] if not args.only or t["id"] in args.only]
    masters: Path = args.masters_dir
    masters.mkdir(parents=True, exist_ok=True)
    report_path = masters / "report.json"
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    for track in tracks:
        seed = args.seed if args.seed is not None else track["seed"]
        print(f"[{track['id']}] seed={seed} duration={track['duration_seconds']}s", flush=True)
        if args.reencode:
            raw, used_seed, attempts = _existing_raw(masters, track["id"], seed), seed, []
            used_seed = int(raw.stem.rsplit("_s", 1)[1])
        else:
            save_composition_prompt(track, masters)
            raw, used_seed, attempts = generate_raw(track, spec["defaults"], masters, seed)
        result = finish(track, spec["defaults"], masters, raw)
        report[track["id"]] = {"seed": used_seed, "prompt": track["prompt"],
                               "attempts": attempts or report.get(track["id"], {}).get("attempts", []),
                               **result}
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"  -> {result}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
