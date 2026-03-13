#!/usr/bin/env python3
"""
Shattered Stars - Missing Portrait Generator
Generates portrait_command.png and optional talking-animation variants
for pilots using the local Stable Diffusion Forge WebUI API.

Usage:
    python scripts/generate_missing_portraits.py             # command portrait only
    python scripts/generate_missing_portraits.py --talk      # + talking variants
    python scripts/generate_missing_portraits.py --all       # command + all talking
    python scripts/generate_missing_portraits.py --force     # overwrite existing

Requires:
    - Stable Diffusion Forge running at http://127.0.0.1:7860
    - pip install requests pillow (pillow optional, for validation)
"""

import argparse
import base64
import json
import os
import time
from pathlib import Path
from typing import Optional

import requests

# ── Configuration ───────────────────────────────────────────────────────────

FORGE_API = "http://127.0.0.1:7860"
PORTRAITS_DIR = Path("public/assets/portraits")

# Model preference order — first available is used
SDXL_MODELS   = ["dreamshaperXL_lightningDPMSDE.safetensors", "dreamshaperXL"]
SD15_MODELS   = ["dreamshaper_8.safetensors", "dreamshaper_8"]

# LoRA preference order for portraits (SDXL)
SDXL_PORTRAIT_LORAS = [
    ("StainedGlassPortrait_SDXL", 0.75),
    ("StainedGlass_SDXL",         0.65),
    ("concept_art",               0.60),
]
SD15_PORTRAIT_LORAS = [
    ("concept_art",  0.65),
    ("scifi_style",  0.55),
]

# ── Portrait Definitions ─────────────────────────────────────────────────────

COMMAND_PORTRAIT = {
    "key":    "portrait_command",
    "output": PORTRAITS_DIR / "portrait_command.png",
    "sdxl_prompt": (
        "military command officer, space navy HQ, comms headset, dark tactical command center, "
        "holographic displays in background, authoritative, stern, Terran Hegemony faction, "
        "steel blue and gold uniform, portrait, character art, game character portrait, "
        "Chris Metzen art style, bold design, rich colors, high quality, detailed face"
    ),
    "sd15_prompt": (
        "military command officer, space navy, communications headset, command center, "
        "dark background, blue holographic screens, authoritative portrait, sci-fi game character, "
        "Chris Metzen art style, detailed face, bold design"
    ),
    "negative": (
        "text, watermark, signature, blurry, low quality, deformed, "
        "full body, anime style, multiple people, civilian clothes"
    ),
}

# Named pilot portraits that may need talking-animation variants
PILOT_PORTRAITS = [
    {
        "key":     "portrait_admiral_chen",
        "faction": "terran_hegemony",
        "name":    "admiral_chen",
        "sdxl_prompt": (
            "Admiral Marcus Chen, stern military commander, imperial blue uniform, gold insignia, "
            "authoritative expression, space navy admiral, Terran Hegemony, portrait, character art, "
            "Chris Metzen art style, bold design, rich colors, game character portrait, detailed face"
        ),
        "sd15_prompt": (
            "Admiral Marcus Chen, stern military commander, imperial blue uniform, gold insignia, "
            "authoritative, space navy admiral, portrait, sci-fi game character, detailed face"
        ),
        "negative": (
            "text, watermark, blurry, low quality, deformed, "
            "full body, anime style, multiple people"
        ),
    },
    {
        "key":     "portrait_striker",
        "faction": "terran_hegemony",
        "name":    "striker",
        "sdxl_prompt": (
            "Commander Striker, veteran ace fighter pilot, battle-scarred face, flight suit, "
            "determined expression, space warfare veteran, Terran Hegemony pilot, portrait, "
            "character art, Chris Metzen art style, detailed face, bold design, rich colors"
        ),
        "sd15_prompt": (
            "Commander Striker, veteran ace pilot, battle-scarred, flight suit, "
            "determined, space fighter pilot portrait, sci-fi game character, detailed face"
        ),
        "negative": (
            "text, watermark, blurry, low quality, deformed, full body, anime style, multiple people"
        ),
    },
    {
        "key":     "portrait_whisper",
        "faction": "terran_hegemony",
        "name":    "whisper",
        "sdxl_prompt": (
            "Whisper, elite stealth pilot, dark visor helmet, shadow operative, mysterious expression, "
            "black tactical suit, stealth fighter pilot, Terran Hegemony, portrait, character art, "
            "Chris Metzen art style, bold design, detailed face, high quality"
        ),
        "sd15_prompt": (
            "Whisper, elite stealth pilot, dark visor, shadow operative, mysterious, "
            "black tactical suit, portrait, sci-fi game character, detailed face"
        ),
        "negative": (
            "text, watermark, blurry, low quality, deformed, full body, anime style, multiple people"
        ),
    },
]

# ── API Helpers ──────────────────────────────────────────────────────────────

def check_api() -> bool:
    try:
        r = requests.get(f"{FORGE_API}/sdapi/v1/sd-models", timeout=5)
        return r.status_code == 200
    except Exception:
        return False

def get_models() -> list[str]:
    try:
        r = requests.get(f"{FORGE_API}/sdapi/v1/sd-models", timeout=5)
        return [m["title"] for m in r.json()]
    except Exception:
        return []

def get_loras() -> list[str]:
    try:
        r = requests.get(f"{FORGE_API}/sdapi/v1/loras", timeout=5)
        return [l["name"] for l in r.json()]
    except Exception:
        return []

def pick_model(models: list[str]) -> tuple[str, bool]:
    """Returns (model_name, is_sdxl)"""
    lower = [m.lower() for m in models]
    for want in SDXL_MODELS:
        for i, m in enumerate(lower):
            if want.lower() in m:
                return models[i], True
    for want in SD15_MODELS:
        for i, m in enumerate(lower):
            if want.lower() in m:
                return models[i], False
    return models[0] if models else ("", False)

def pick_lora(loras: list[str], is_sdxl: bool) -> tuple[Optional[str], float]:
    """Returns (lora_name, weight) or (None, 0)"""
    candidates = SDXL_PORTRAIT_LORAS if is_sdxl else SD15_PORTRAIT_LORAS
    lower_loras = [l.lower() for l in loras]
    for name, weight in candidates:
        for i, l in enumerate(lower_loras):
            if name.lower() in l:
                return loras[i], weight
    return None, 0.0

def set_model(model_name: str) -> None:
    try:
        requests.post(
            f"{FORGE_API}/sdapi/v1/options",
            json={"sd_model_checkpoint": model_name},
            timeout=60
        )
        time.sleep(2)
    except Exception as e:
        print(f"  Warning: could not set model: {e}")

def generate(
    prompt: str,
    negative: str,
    width: int = 512,
    height: int = 768,
    steps: int = 20,
    cfg: float = 7.0,
    lora: Optional[str] = None,
    lora_weight: float = 0.8,
    seed: int = -1,
) -> Optional[bytes]:
    full_prompt = (f"<lora:{lora}:{lora_weight}> " if lora else "") + prompt
    payload = {
        "prompt": full_prompt,
        "negative_prompt": negative,
        "width": width,
        "height": height,
        "steps": steps,
        "cfg_scale": cfg,
        "sampler_name": "DPM++ 2M Karras",
        "seed": seed,
        "batch_size": 1,
    }
    try:
        r = requests.post(f"{FORGE_API}/sdapi/v1/txt2img", json=payload, timeout=180)
        if r.status_code == 200:
            images = r.json().get("images", [])
            return base64.b64decode(images[0]) if images else None
        print(f"  API error {r.status_code}")
        return None
    except Exception as e:
        print(f"  Request failed: {e}")
        return None

# ── Talk variant modifier ────────────────────────────────────────────────────

TALK_MODIFIER = (
    "mouth slightly open, speaking expression, mid-sentence, "
    "natural talking pose, expressive face"
)
TALK_NEGATIVE_ADD = ", closed mouth, neutral expression, silent"

# ── Main Generation ──────────────────────────────────────────────────────────

def generate_portrait(
    spec: dict,
    is_sdxl: bool,
    lora: Optional[str],
    lora_weight: float,
    output_path: Path,
    talking: bool = False,
    force: bool = False,
) -> bool:
    if output_path.exists() and not force:
        print(f"  [SKIP] {output_path.name} (exists)")
        return True

    base_prompt = spec["sdxl_prompt"] if is_sdxl else spec["sd15_prompt"]
    if talking:
        base_prompt = f"{TALK_MODIFIER}, {base_prompt}"

    negative = spec["negative"]
    if talking:
        negative = negative + TALK_NEGATIVE_ADD

    width  = 1024 if is_sdxl else 512
    height = 1536 if is_sdxl else 768
    steps  = 8    if is_sdxl else 25
    cfg    = 2.5  if is_sdxl else 7.0  # Lightning needs low CFG

    tag = "(talk)" if talking else ""
    print(f"  [GEN] {output_path.name} {tag}...", end=" ", flush=True)

    data = generate(base_prompt, negative, width, height, steps, cfg, lora, lora_weight)

    if data:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(data)
        print("OK")
        return True
    else:
        print("FAILED")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate missing Shattered Stars portraits")
    parser.add_argument("--talk",  action="store_true", help="Also generate talking variants for TH pilots")
    parser.add_argument("--all",   action="store_true", help="Generate command portrait + all talking variants")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()

    if args.all:
        args.talk = True

    # Check Forge
    print("Checking Forge WebUI API...")
    if not check_api():
        print(f"ERROR: Forge not reachable at {FORGE_API}")
        print("Please start Forge (run.bat) and wait for it to load, then run again.")
        return

    print("  Forge is running")

    # Detect model + LoRA
    models = get_models()
    loras  = get_loras()
    model, is_sdxl = pick_model(models)
    lora, lora_weight = pick_lora(loras, is_sdxl)

    model_type = "SDXL" if is_sdxl else "SD1.5"
    print(f"  Model: {model} ({model_type})")
    print(f"  LoRA:  {lora or 'none'} (weight {lora_weight})")

    # Set model
    print(f"\nSetting model: {model}")
    set_model(model)

    # Always generate portrait_command
    print("\n=== COMMAND PORTRAIT ===")
    generate_portrait(
        COMMAND_PORTRAIT, is_sdxl, lora, lora_weight,
        COMMAND_PORTRAIT["output"],
        force=args.force
    )

    # Optionally generate talking variants
    if args.talk:
        print("\n=== TALKING VARIANTS (Terran Hegemony) ===")
        for pilot in PILOT_PORTRAITS:
            faction_dir = PORTRAITS_DIR / pilot["faction"]
            out_path = faction_dir / f"{pilot['name']}_talk.png"
            generate_portrait(
                pilot, is_sdxl, lora, lora_weight,
                out_path, talking=True, force=args.force
            )
            time.sleep(0.5)

    print("\nDone.")
    print("\nNext step:")
    if args.talk:
        print("  Run: python scripts/wire_portrait_animation.py")
        print("  to update BootScene to load the talk variants as spritesheets")
    else:
        print("  portrait_command.png saved to public/assets/portraits/portrait_command.png")
        print("  BootScene will load it automatically on next game start")


if __name__ == "__main__":
    main()
