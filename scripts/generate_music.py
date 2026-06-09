#!/usr/bin/env python3
"""generate_music.py — Generate all 27 Shattered Stars tracks via Harmonia.

Runs tracks in the prescribed order:
  1. Motifs (void_tide_cell, nexus_broadcast)
  2. Tactical loops — all 5 factions
  3. Combat loops — all 5 factions
  4. Boss tracks — all 5 factions
  5. Short stings (victory / defeat / awakening / prophecy / heist)
  6. Void Tide tracks last

Usage:
  python scripts/generate_music.py
  python scripts/generate_music.py --skip-done   # skip already-complete tracks
  python scripts/generate_music.py --dry-run     # print plan without generating
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass

HARMONIA = "http://localhost:8002"
PROJECT   = "shattered_stars"

SYNTHETIC_CTX = (
    "Synthesizer and electronic instruments only. "
    "Absolutely no acoustic instruments. Pure electronic/digital textures."
)
ASCENDANT_CTX = (
    "Non-Western instruments only: duduk, erhu, oud, bansuri. "
    "432Hz reference tuning. Vast reverb, vast space. Minimum notes — silence is the texture. "
    "Meditative and ancient."
)
VOID_TIDE_CTX = (
    "No melody whatsoever. No harmony. No rhythm. "
    "Subsonic atmospheric texture only — below conscious hearing threshold. "
    "The absence of music is the point."
)


@dataclass
class Track:
    track_id: str
    era_id:   str
    mood:     str
    duration_seconds: int
    seed:     int
    additional_context: str = ""
    track_id_override: str = ""

    @property
    def duration_minutes(self) -> float:
        return self.duration_seconds / 60.0


TRACKS: list[Track] = [
    # ── Motifs ────────────────────────────────────────────────────────────────
    Track("motif_void_tide_cell_base",  "void_tide", "motif", 15,  200,
          "Three descending semitones, Phrygian mode, no accompaniment, "
          "clinical and inhuman. Pure motif cell — state the 3-note descent once, "
          "then silence. The game will loop only the relevant portion.",
          track_id_override="motif_void_tide_cell_base"),
    Track("motif_nexus_broadcast_base", "synthetic", "motif", 15,  201,
          "Electronic click-tone activation signal, not musical, "
          "clinical machine sound, Prometheus Station broadcast. "
          "State the signal in the first few seconds, then silence.",
          track_id_override="motif_nexus_broadcast_base"),

    # ── Tactical loops ───────────────────────────────────────────────────────
    Track("heg_tactical",  "hegemony",      "tactical", 180, 500),
    Track("conf_tactical", "confederation", "tactical", 180, 501),
    Track("syn_tactical",  "synthetic",     "tactical", 180, 502, SYNTHETIC_CTX),
    Track("cors_tactical", "corsairs",      "tactical", 180, 503),
    Track("asc_tactical",  "ascendant",     "tactical", 180, 504, ASCENDANT_CTX),

    # ── Combat loops ─────────────────────────────────────────────────────────
    Track("heg_combat",    "hegemony",      "combat",   120, 510),
    Track("conf_combat",   "confederation", "combat",   120, 511),
    Track("syn_combat",    "synthetic",     "combat",   120, 512, SYNTHETIC_CTX),
    Track("cors_combat",   "corsairs",      "combat",   120, 513),
    Track("asc_combat",    "ascendant",     "combat",   120, 514, ASCENDANT_CTX),

    # ── Boss tracks ──────────────────────────────────────────────────────────
    Track("heg_boss",      "hegemony",      "boss",     300, 520),
    Track("conf_boss",     "confederation", "boss",     240, 521),
    Track("syn_boss",      "synthetic",     "boss",     240, 522, SYNTHETIC_CTX),
    Track("cors_boss",     "corsairs",      "boss",     240, 523),
    Track("asc_boss",      "ascendant",     "boss",     300, 524, ASCENDANT_CTX),

    # ── Short stings ─────────────────────────────────────────────────────────
    Track("heg_victory",   "hegemony",      "victory",   30, 530),
    Track("heg_defeat",    "hegemony",      "defeat",    20, 531),
    Track("conf_victory",  "confederation", "victory",   25, 532),
    Track("conf_defeat",   "confederation", "defeat",    20, 533),
    Track("syn_awakening", "synthetic",     "awakening", 60, 534, SYNTHETIC_CTX),
    Track("cors_heist",    "corsairs",      "heist",    120, 535),
    Track("asc_prophecy",  "ascendant",     "prophecy",  45, 536, ASCENDANT_CTX),

    # ── Void Tide last ────────────────────────────────────────────────────────
    Track("void_encounter",       "void_tide", "encounter", 120, 540, VOID_TIDE_CTX),
    Track("void_nexus_discovery", "void_tide", "discovery",  60, 541, VOID_TIDE_CTX),
    Track("void_campaign_credits","void_tide", "credits",   120, 542, VOID_TIDE_CTX),
]


def get(path: str) -> dict:
    url = f"{HARMONIA}{path}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read())


def post(path: str, payload: dict) -> dict:
    url   = f"{HARMONIA}{path}"
    data  = json.dumps(payload).encode()
    req   = urllib.request.Request(url, data=data,
                                   headers={"Content-Type": "application/json"},
                                   method="POST")
    with urllib.request.urlopen(req, timeout=600) as resp:
        return json.loads(resp.read())


def get_done_ids() -> set[str]:
    status = get(f"/projects/{PROJECT}/assets/status")
    # missing_track_ids is what we still need
    missing = set(status.get("missing_track_ids", []))
    all_ids  = {t.track_id for t in TRACKS}
    return all_ids - missing


def generate(track: Track) -> dict:
    payload: dict = {
        "era_id":           track.era_id,
        "mood":             track.mood,
        "duration_minutes": track.duration_minutes,
        "seed":             track.seed,
        "additional_context": track.additional_context,
    }
    payload["track_id_override"] = track.track_id_override or track.track_id

    return post(f"/projects/{PROJECT}/generate/ace-step", payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-done", action="store_true",
                        help="Skip tracks that are already registered")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print generation plan without running")
    args = parser.parse_args()

    done_ids: set[str] = get_done_ids() if args.skip_done else set()

    total     = len(TRACKS)
    succeeded = 0
    failed: list[tuple[str, str]] = []

    for i, track in enumerate(TRACKS, 1):
        if track.track_id in done_ids:
            print(f"[{i:02d}/{total}] SKIP  {track.track_id}  (already done)")
            succeeded += 1
            continue

        mins = f"{track.duration_minutes:.2f}".rstrip("0").rstrip(".")
        print(f"[{i:02d}/{total}] GEN   {track.track_id}  "
              f"era={track.era_id} mood={track.mood} "
              f"dur={mins}min seed={track.seed}", end="", flush=True)

        if args.dry_run:
            print("  [DRY RUN]")
            continue

        t0 = time.time()
        try:
            result = generate(track)
            elapsed = time.time() - t0
            file_id = result.get("track_id") or result.get("id") or "?"
            print(f"  OK  ({elapsed:.0f}s)  ->  {file_id}")
            succeeded += 1
        except Exception as exc:
            elapsed = time.time() - t0
            print(f"  FAIL ({elapsed:.0f}s): {exc}")
            failed.append((track.track_id, str(exc)))

    print(f"\n{'='*60}")
    print(f"Results: {succeeded}/{total} succeeded  |  {len(failed)} failed")
    if failed:
        print("Failed tracks:")
        for tid, err in failed:
            print(f"  {tid}: {err}")
        sys.exit(1)


if __name__ == "__main__":
    main()
