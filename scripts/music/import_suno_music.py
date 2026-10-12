#!/usr/bin/env python3
"""import_suno_music.py — Turn the author's Suno takes into game music files.

Reads the spec (scripts/music/suno_tracks.json), decodes each source take from
the read-only library (never written to), QC-checks it, cuts a seamless loop
(or a faded one-shot stinger), normalises to -16 LUFS and encodes
public/assets/audio/music/<id>.ogg|.mp3. Scratch WAVs live in %TEMP% and are
deleted afterwards.

Usage:
  python -B scripts/music/import_suno_music.py               # all tracks
  python -B scripts/music/import_suno_music.py --only menu_main boss_dreadnought
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True  # never leave __pycache__ in the repo (Vite watcher)

import argparse
import json
import shutil
import tempfile
from pathlib import Path

import music_post as post

SPEC_PATH = Path(__file__).with_name("suno_tracks.json")
GAME_MUSIC_DIR = Path(__file__).resolve().parents[2] / "public" / "assets" / "audio" / "music"


def process(track: dict, defaults: dict, root: Path, work: Path) -> dict[str, object]:
    """Decode → QC → loop/one-shot → normalise → encode one track."""
    source = root / track["source"]
    if not source.exists():
        raise FileNotFoundError(source)
    decoded = work / f"{track['id']}_src.wav"
    post.decode_to_wav(source, decoded)
    segment = tuple(track["segment"]) if "segment" in track else None
    one_shot = "one_shot_seconds" in track
    wanted = track.get("one_shot_seconds", track.get("loop_seconds"))
    qc = post.analyse(decoded, wanted, sparse=False)
    cut = work / f"{track['id']}_cut.wav"
    if one_shot:
        length = post.make_one_shot(decoded, cut, wanted, defaults["one_shot_fade_seconds"], segment)
        seam = None
    else:
        length, seam = post.make_seamless_loop(decoded, cut, wanted,
                                               defaults["loop_crossfade_seconds"], segment,
                                               defaults["loop_start_search_seconds"])
    master = work / f"{track['id']}.wav"
    mastered = post.master_and_encode(cut, master, GAME_MUSIC_DIR, track["id"])
    return {"id": track["id"], "source_take": Path(track["source"]).stem,
            "kind": "one-shot" if one_shot else "loop", "seconds": round(length, 2),
            "seam_similarity": seam, "source_problems": list(qc.problems),
            "source_clip_fraction": qc.clip_fraction, **mastered}


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--only", nargs="*", help="track ids to process")
    args = parser.parse_args()
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    root = Path(spec["source_root"])
    tracks = [t for t in spec["tracks"] if not args.only or t["id"] in args.only]
    work = Path(tempfile.mkdtemp(prefix="ss_suno_"))
    try:
        for track in tracks:
            print(json.dumps(process(track, spec["defaults"], root, work)), flush=True)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
