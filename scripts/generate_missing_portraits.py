#!/usr/bin/env python3
"""
Shattered Stars - Portrait Generator
Generates pilot portrait PNGs for all factions via the shared SD queue server.

Usage:
    python scripts/generate_missing_portraits.py                   # all factions
    python scripts/generate_missing_portraits.py --faction th      # terran_hegemony only
    python scripts/generate_missing_portraits.py --talk            # also _talk variants
    python scripts/generate_missing_portraits.py --all             # base + talk for everything
    python scripts/generate_missing_portraits.py --force           # overwrite existing files
    python scripts/generate_missing_portraits.py --no-wait         # submit and exit
"""

import argparse
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent))
from sd_queue import submit_and_start_worker, submit, QUEUE_DIR

PORTRAITS_DIR = Path(__file__).parent.parent / "public" / "assets" / "portraits"

# ── Model settings ────────────────────────────────────────────────────────────

CHECKPOINT = "dreamshaper_8.safetensors"
LORA       = "concept_art"
LORA_W     = 0.60

NEGATIVE = (
    "text, watermark, signature, blurry, low quality, deformed, "
    "full body, anime style, multiple people, logo, frame, border"
)
TALK_PREFIX = (
    "mouth slightly open, speaking expression, mid-sentence, "
    "natural talking pose, expressive animated face, "
)

# ── Portrait definitions ──────────────────────────────────────────────────────
# talk=False disables talking variant for that portrait (default True)

PORTRAITS: dict[str, dict] = {

    # ---- Standalone / UI -------------------------------------------------------
    "portrait_command": {
        "output": PORTRAITS_DIR / "portrait_command.png",
        "prompt": (
            "military command officer, space navy command centre, "
            "headset, dark tactical holographic displays behind, "
            "authoritative stern expression, Terran Hegemony steel blue gold uniform, "
            "portrait, character art, Chris Metzen style, bold rich colors, "
            "detailed face, detailed hair, game portrait"
        ),
        "talk": False,
    },

    # ---- Terran Hegemony -------------------------------------------------------
    "portrait_admiral_chen": {
        "output": PORTRAITS_DIR / "terran_hegemony" / "admiral_chen.png",
        "prompt": (
            "Admiral Marcus Chen, stern military commander, "
            "imperial blue uniform with gold insignia, admiral's peaked cap, "
            "authoritative expression, space navy admiral, Asian features, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_striker": {
        "output": PORTRAITS_DIR / "terran_hegemony" / "striker.png",
        "prompt": (
            "Lt. Reyes, veteran ace fighter pilot, "
            "battle-scarred face, blue scar on cheek, flight suit, "
            "determined expression, space warfare veteran, Terran Hegemony pilot, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_whisper": {
        "output": PORTRAITS_DIR / "terran_hegemony" / "whisper.png",
        "prompt": (
            "Cdr. Vasile, elite stealth pilot, dark visor goggles pushed up on helmet, "
            "shadow operative, intense expression, "
            "black tactical flight suit, Terran Hegemony, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },

    # ---- Free Confederation ---------------------------------------------------
    "portrait_commander_santos": {
        "output": PORTRAITS_DIR / "free_confederation" / "commander_santos.png",
        "prompt": (
            "Commander Yara Santos, Free Confederation fleet officer, "
            "warm confident expression, mixed heritage, short dark hair, "
            "olive green uniform with gold trim, democratic republic insignia, "
            "holographic star map behind, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_phoenix_one": {
        "output": PORTRAITS_DIR / "free_confederation" / "phoenix_one.png",
        "prompt": (
            "Phoenix One, Free Confederation ace pilot, "
            "young fearless expression, ember-orange streaks in hair, "
            "worn flight jacket, confederation wing badge, cockpit behind, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_doc_vasquez": {
        "output": PORTRAITS_DIR / "free_confederation" / "doc_vasquez.png",
        "prompt": (
            "Dr. Elena Vasquez, Free Confederation support officer, "
            "calm reassuring expression, grey-streaked temples, glasses, "
            "medical corps uniform, confederation humanitarian badge, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },

    # ---- Synthetic Collective -------------------------------------------------
    "portrait_omega_7": {
        "output": PORTRAITS_DIR / "synthetic_collective" / "omega_7.png",
        "prompt": (
            "Omega-7, Synthetic Collective combat android, "
            "sleek humanoid face, glowing cyan optical sensors, "
            "silver and white chassis, etched circuit patterns on skin, "
            "cold calculating expression, blue ambient light, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_prime_collective": {
        "output": PORTRAITS_DIR / "synthetic_collective" / "prime_collective.png",
        "prompt": (
            "Prime Collective, Synthetic Collective central intelligence, "
            "ethereal androgynous android visage, layered visual processing arrays, "
            "geometric light patterns across face, "
            "serene omniscient expression, deep blue holographic aura, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_unit_zero": {
        "output": PORTRAITS_DIR / "synthetic_collective" / "unit_zero.png",
        "prompt": (
            "Unit Zero, Synthetic Collective elite warrior unit, "
            "battle-scarred chrome plating, exposed dark metallic endoskeleton at jaw, "
            "single glowing red targeting eye, fierce relentless expression, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },

    # ---- Void Corsairs --------------------------------------------------------
    "portrait_captain_kira": {
        "output": PORTRAITS_DIR / "void_corsairs" / "captain_kira.png",
        "prompt": (
            "Captain Kira, Void Corsairs pirate captain, "
            "charming dangerous smile, weathered tan skin, braided hair, "
            "worn leather duster with void corsair skull emblem, nebula backdrop, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_the_admiral": {
        "output": PORTRAITS_DIR / "void_corsairs" / "the_admiral.png",
        "prompt": (
            "The Admiral, elder Void Corsairs warlord, "
            "battle-hardened face, braided silver beard, cybernetic eye patch, "
            "patchwork coat draped with corsair trophies and medals, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_bloodfang": {
        "output": PORTRAITS_DIR / "void_corsairs" / "bloodfang.png",
        "prompt": (
            "Bloodfang, Void Corsairs brutal enforcer, "
            "wild fierce expression, ritual scarification on face, "
            "heavy combat armor adorned with skulls, glowing red energy scar, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },

    # ---- Ascendant Empire -----------------------------------------------------
    "portrait_the_dreamer": {
        "output": PORTRAITS_DIR / "ascendant_empire" / "the_dreamer.png",
        "prompt": (
            "The Dreamer, Ascendant Empire visionary, "
            "otherworldly androgynous features, glowing violet third eye on forehead, "
            "layered silk robes with bioluminescent patterns, "
            "serene transcendent expression, golden spore particles drifting, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_archon_zaelthar": {
        "output": PORTRAITS_DIR / "ascendant_empire" / "archon_zaelthar.png",
        "prompt": (
            "Archon Zaelthar, Ascendant Empire ancient ruler, "
            "tall elongated brow, deep sunken glowing amber eyes, "
            "ornate golden-purple ceremonial armor with biomechanical ornamentation, "
            "imperious ancient expression, golden spores trailing, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
    "portrait_herald": {
        "output": PORTRAITS_DIR / "ascendant_empire" / "herald.png",
        "prompt": (
            "The Herald, Ascendant Empire swift messenger, "
            "intent focused expression, asymmetric bioluminescent markings on face, "
            "light flowing silver-violet armor, "
            "golden mist and nebula backdrop, "
            "portrait, character art, Chris Metzen style, bold rich colors, detailed face"
        ),
    },
}

# Faction short-key groupings
FACTION_KEYS: dict[str, list[str]] = {
    "command": ["portrait_command"],
    "th":      ["portrait_admiral_chen", "portrait_striker", "portrait_whisper"],
    "confed":  ["portrait_commander_santos", "portrait_phoenix_one", "portrait_doc_vasquez"],
    "synth":   ["portrait_omega_7", "portrait_prime_collective", "portrait_unit_zero"],
    "corsair": ["portrait_captain_kira", "portrait_the_admiral", "portrait_bloodfang"],
    "ascend":  ["portrait_the_dreamer", "portrait_archon_zaelthar", "portrait_herald"],
}


def build_jobs(keys: list[str], talking: bool = False, force: bool = False) -> list[dict]:
    jobs = []
    for key in keys:
        spec = PORTRAITS[key]
        if talking and not spec.get("talk", True):
            continue

        base_out = spec["output"]
        if talking:
            out    = base_out.with_name(base_out.stem + "_talk" + base_out.suffix)
            prompt = TALK_PREFIX + spec["prompt"]
            jid    = key + "_talk"
        else:
            out    = base_out
            prompt = spec["prompt"]
            jid    = key

        if out.exists() and not force:
            print(f"  [SKIP] {out.name} (exists)")
            continue

        out.parent.mkdir(parents=True, exist_ok=True)
        jobs.append({
            "id":          jid,
            "project":     "shattered-stars",
            "checkpoint":  CHECKPOINT,
            "lora":        LORA,
            "lora_weight": LORA_W,
            "prompt":      prompt,
            "negative":    NEGATIVE,
            "width":       512,
            "height":      768,
            "steps":       25,
            "cfg":         7.0,
            "sampler":     "DPM++ 2M Karras",
            "seed":        -1,
            "output":      str(out.resolve()),
        })
    return jobs


def main():
    parser = argparse.ArgumentParser(description="Generate Shattered Stars pilot portraits")
    parser.add_argument("--faction", default="all",
                        help="all | command | th | confed | synth | corsair | ascend")
    parser.add_argument("--talk",    action="store_true", help="Generate _talk variants")
    parser.add_argument("--all",     action="store_true", help="Base + talk for everything")
    parser.add_argument("--force",   action="store_true", help="Overwrite existing files")
    parser.add_argument("--no-wait", action="store_true", help="Submit and exit")
    args = parser.parse_args()

    if args.all:
        args.talk = True

    if args.faction == "all":
        keys = list(PORTRAITS.keys())
    elif args.faction in FACTION_KEYS:
        keys = list(PORTRAITS.keys()) if args.faction == "all" else (
            ["portrait_command"] + FACTION_KEYS[args.faction]
            if args.faction != "command" else FACTION_KEYS["command"]
        )
    else:
        print(f"Unknown faction '{args.faction}'. Options: {list(FACTION_KEYS)}")
        sys.exit(1)

    jobs: list[dict] = []
    jobs += build_jobs(keys, talking=False, force=args.force)
    if args.talk:
        jobs += build_jobs(keys, talking=True, force=args.force)

    if not jobs:
        print("No jobs to run (all files exist). Use --force to regenerate.")
        return

    print(f"\nSubmitting {len(jobs)} job(s) to SD queue server")
    print(f"  checkpoint : {CHECKPOINT}")
    print(f"  lora       : {LORA} @ {LORA_W}")
    print()
    for j in jobs:
        print(f"  -> {Path(j['output']).name}")
    print()

    if args.no_wait:
        QUEUE_DIR.mkdir(parents=True, exist_ok=True)
        ids = submit(jobs)
        print(f"Submitted {len(ids)} job(s). Run `python scripts/sd_queue.py worker` to process.")
    else:
        results = submit_and_start_worker(jobs, wait=True)
        successes = sum(1 for v in results.values() if v == "done")
        failures  = sum(1 for v in results.values() if v == "failed")
        print(f"\nDone: {successes} OK, {failures} failed")
        if failures:
            print(f"  Failed: {[k for k, v in results.items() if v == 'failed']}")
            print(f"  Check:  {QUEUE_DIR}")
        if successes > 0:
            print("\nPortraits written. Restart Vite dev server to pick up new assets.")


if __name__ == "__main__":
    main()
