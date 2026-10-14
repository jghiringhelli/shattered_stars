#!/usr/bin/env python3
"""generate_creature_art.py — Generate the creature sprites (boss / monster set).

Submits 512x512 txt2img jobs to the shared SD queue server (port 8010), keys the
near-black backdrop to alpha (same flood fill as key_ship_alpha.py), mirrors
left-to-right where a sprite is flagged symmetric, and writes RGBA PNGs to
public/assets/creatures/. Top-down, head/front pointing UP, centred.

Usage:
  python scripts/generate_creature_art.py                       # all sprites
  python scripts/generate_creature_art.py --only creature_deepmaw_body
  python scripts/generate_creature_art.py --only deepmaw_body --seed 7
  python scripts/generate_creature_art.py --dry-run

Requires: Forge on :7860 (dreamshaper_8) and the queue server on :8010.
Raw generations are kept in %TEMP%/shattered_stars_creatures for review.
"""
import argparse
import base64
import io
import os
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageFilter

sys.dont_write_bytecode = True  # importing key_ship_alpha must not leave __pycache__ in the repo
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import key_ship_alpha  # noqa: E402
from key_ship_alpha import EDGE_FEATHER, background_mask  # noqa: E402

# Creatures have dark plates; a stricter floor than the ship keyer keeps them opaque.
BACKGROUND_FLOOR = 20.0

QUEUE_URL = os.environ.get("SD_QUEUE_URL", "http://127.0.0.1:8010")
OUTPUT_DIR = SCRIPT_DIR.parent / "public" / "assets" / "creatures"
RAW_DIR = Path(tempfile.gettempdir()) / "shattered_stars_creatures"

SIZE = 512
POLL_SECONDS = 3.0
JOB_TIMEOUT_SECONDS = 600.0
FILL_FRACTION = 0.84  # subject spans ~84 % of the frame => ~8 % margin each side
MAX_BORDER_LUMINANCE = 30.0  # raw generations with a brighter border ring are rejected (backdrop not black)

# Same look as the ship sprite pipeline: dreamshaper_8 + concept_art @ 0.6.
STYLE_PREFIX = (
    "<lora:concept_art:0.6> "
    "top-down view, bird's eye view from directly above, centered, single creature, isolated game sprite, "
    "glossy illustrated, glowing stained-glass colors, high contrast, bold shapes, (pure black background:1.3), "
)
NEGATIVE_PROMPT = (
    "text, watermark, blurry, multiple creatures, cropped, background scenery, "
    "ground, planet, person, photo, low quality, jpeg artifacts, side view, window, frame, border, mandala, "
    "circular frame, stained glass window, vignette, stars, nebula, woman, girl, human face, humanoid, "
    "breasts, nude, nsfw, hair, skin, white background, gradient background"
)
STEPS = 28
CFG = 7.0
SAMPLER = "DPM++ 2M Karras"


@dataclass(frozen=True)
class Creature:
    """One sprite: prompt, candidate seeds (first is the chosen one) and symmetry flag."""

    prompt: str
    seeds: tuple
    symmetric: bool = False


# Seeds: the first seed is the one the checked-in art was picked from; extras are fallbacks.
CREATURES: dict = {
    "creature_cinder_wyrm_body": Creature(
        "dorsal view of a plasma-furnace space serpent head, symmetrical like a starfighter seen from above, "
        "snout pointing up, armored ember-orange and charcoal plates, glowing furnace throat, maw slightly open, "
        "two horns and fins swept back, molten cracks, flat top-down silhouette",
        (102, 101, 103), symmetric=True),
    "creature_cinder_wyrm_segment": Creature(
        "top-down view of a single round armor disc plate, concentric ring of ember-orange glowing plates with "
        "black metal bolts, two small spiky fins on left and right, mechanical, symmetrical emblem-like",
        (213, 211, 212), symmetric=True),
    "creature_deepmaw_body": Creature(
        "colossal abyssal void leviathan seen from above, vast round gaping maw ringed with teeth-like cilia "
        "at the front, six long tentacles trailing and curling around the body, deep indigo and teal "
        "bioluminescence, barnacled hide, maw facing up",
        (302, 301, 303)),
    "creature_choir_hive_body": Creature(
        "glowing amber-green translucent organic hive heart, ring of many round throat sacs like open singing "
        "mouths arranged radially around a central pulsing bulb, spores floating, symmetrical biological "
        "mandala, bioluminescent",
        (413, 412, 411), symmetric=True),
    "creature_choir_hive_pod": Creature(
        "single small spiky brood pod bulb, glowing eye-slit, amber-green, symmetrical, spikes pointing up",
        (501, 502, 503), symmetric=True),
    "creature_pruning_herald_body": Creature(
        "mechanical crystalline heron-like construct seen from above, long pale bone-white crystal body "
        "shaped like a many-bladed pruning shear, void-black armor plates, cold violet-white glow, "
        "thin blade wings spread, one glowing lens eye, beak pointing up, symmetrical starfighter silhouette",
        (602, 601, 603), symmetric=True),
    "creature_warden_avatar_body": Creature(
        "ancient engineered gardener god, vast symmetrical bloom of black iridescent petals and root-like "
        "vines around a hollow glowing violet-white core, geometric alien glyphs etched in the petals, "
        "ominous, regal, radial symmetry",
        (701, 702, 703), symmetric=True),
    "creature_tidecell_body": Creature(
        "single glossy black teardrop shaped orb creature, one big glowing cold violet eye in the center, "
        "thin violet wisps trailing from the tail, simple smooth round silhouette, minimal",
        (811, 812, 813), symmetric=True),
    "creature_hulk_gnawer_body": Creature(
        "top-down view of a mechanical worm head, circular mouth ring of grinding metal teeth mandibles "
        "pointing up, pale grey-brown plated armor, rust stains, symmetrical, pure black background",
        (913, 911, 912), symmetric=True),
    "creature_hulk_gnawer_segment": Creature(
        "top-down view of a single round armor disc plate, concentric ring of pale grey-brown scarred metal "
        "plates with rust stains, two small side spikes on left and right, mechanical, symmetrical",
        (1013, 1011, 1012), symmetric=True),
}


def build_payload(creature: Creature, seed: int) -> dict:
    """Build the Forge txt2img payload for one creature and seed.

    :param creature: sprite definition.
    :param seed: RNG seed.
    :returns: payload dict for POST /jobs.
    """
    return {
        "prompt": STYLE_PREFIX + creature.prompt,
        "negative_prompt": NEGATIVE_PROMPT,
        "width": SIZE,
        "height": SIZE,
        "steps": STEPS,
        "cfg_scale": CFG,
        "sampler_name": SAMPLER,
        "seed": seed,
        "override_settings": {"sd_model_checkpoint": "dreamshaper_8.safetensors"},
    }


def run_job(payload: dict) -> Image.Image:
    """Submit one job to the queue server, wait for it and decode the image.

    :param payload: Forge txt2img payload.
    :returns: the generated RGB image.
    :raises RuntimeError: when the job fails or times out.
    """
    response = requests.post(f"{QUEUE_URL}/jobs", json={
        "project": "shattered-stars",
        "endpoint": "/sdapi/v1/txt2img",
        "priority": 5,
        "payload": payload,
    }, timeout=30)
    response.raise_for_status()
    job_id = response.json()["job_id"]

    deadline = time.time() + JOB_TIMEOUT_SECONDS
    while time.time() < deadline:
        job = requests.get(f"{QUEUE_URL}/jobs/{job_id}", timeout=30).json()
        if job["status"] == "succeeded":
            return Image.open(io.BytesIO(base64.b64decode(job["result"]["images"][0]))).convert("RGB")
        if job["status"] == "failed":
            raise RuntimeError(f"job {job_id} failed: {job.get('error') or job.get('result')}")
        time.sleep(POLL_SECONDS)
    raise RuntimeError(f"job {job_id} timed out")


def key_to_rgba(image: Image.Image) -> Image.Image:
    """Key the near-black background to alpha (border flood fill, as key_ship_alpha).

    :param image: RGB generation on a near-black backdrop.
    :returns: RGBA image.
    """
    # Follow slightly lifted backdrops (dark grey rather than black) but never eat mid-tones.
    key_ship_alpha.BACKGROUND_LUMINANCE = max(BACKGROUND_FLOOR, min(45.0, border_luminance(image) + 12))
    rgba = image.convert("RGBA")
    mask = background_mask(np.array(rgba)[:, :, :3])
    alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), mode="L")
    rgba.putalpha(alpha.filter(ImageFilter.GaussianBlur(EDGE_FEATHER)))
    return rgba


def fit_to_frame(image: Image.Image) -> Image.Image:
    """Crop to the opaque bounds, scale to the fill fraction and centre on the canvas.

    :param image: RGBA image with keyed alpha.
    :returns: SIZE x SIZE RGBA image with the subject centred and a transparent margin.
    """
    bounds = image.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if bounds is None:
        raise RuntimeError("keyed image is fully transparent")
    subject = image.crop(bounds)
    scale = SIZE * FILL_FRACTION / max(subject.size)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(subject, ((SIZE - subject.width) // 2, (SIZE - subject.height) // 2), subject)
    return canvas


def mirror_left_half(image: Image.Image) -> Image.Image:
    """Make the sprite left/right symmetric by mirroring its left half onto the right.

    :param image: SIZE x SIZE RGBA image.
    :returns: symmetric RGBA image.
    """
    half = image.crop((0, 0, SIZE // 2, SIZE))
    out = image.copy()
    out.paste(half.transpose(Image.FLIP_LEFT_RIGHT), (SIZE // 2, 0))
    return out


def opaque_share(image: Image.Image) -> float:
    """Return the fraction of pixels that are mostly opaque."""
    return float((np.array(image.getchannel("A")) > 127).mean())


def border_luminance(image: Image.Image) -> float:
    """Return the mean luminance of the outer pixel ring (0-255)."""
    gray = np.array(image.convert("L"), dtype=float)
    ring = np.concatenate([gray[0], gray[-1], gray[:, 0], gray[:, -1]])
    return float(ring.mean())


def process(sprite_id: str, creature: Creature, seeds: tuple) -> int:
    """Generate, key, fit and save one sprite; later seeds are tried if the backdrop is not near-black.

    :param sprite_id: output file stem.
    :param creature: sprite definition.
    :param seeds: seeds to try in order.
    :returns: the seed that was kept.
    :raises RuntimeError: when no seed produced a near-black backdrop.
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for seed in seeds:
        print(f"[{sprite_id}] seed {seed} ...", flush=True)
        raw = run_job(build_payload(creature, seed))
        raw.save(RAW_DIR / f"{sprite_id}_{seed}.png")
        if border_luminance(raw) > MAX_BORDER_LUMINANCE:
            print(f"[{sprite_id}] seed {seed}: backdrop not near-black, trying next seed", flush=True)
            continue

        sprite = fit_to_frame(key_to_rgba(raw))
        if creature.symmetric:
            sprite = mirror_left_half(sprite)
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        sprite.save(OUTPUT_DIR / f"{sprite_id}.png")
        print(f"[{sprite_id}] saved (seed {seed}), {opaque_share(sprite):.1%} opaque", flush=True)
        return seed
    raise RuntimeError(f"no near-black backdrop for any of seeds {seeds}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate creature sprites via the SD queue.")
    parser.add_argument("--only", metavar="ID", help="one sprite id, with or without the creature_ prefix")
    parser.add_argument("--seed", type=int, help="use only this seed (with --only)")
    parser.add_argument("--dry-run", action="store_true", help="print prompts, submit nothing")
    args = parser.parse_args()

    ids = list(CREATURES)
    if args.only:
        wanted = args.only if args.only.startswith("creature_") else f"creature_{args.only}"
        if wanted not in CREATURES:
            print(f"Unknown sprite id: {args.only}", file=sys.stderr)
            return 1
        ids = [wanted]

    for sprite_id in ids:
        creature = CREATURES[sprite_id]
        seeds = (args.seed,) if args.seed is not None and args.only else creature.seeds
        if args.dry_run:
            print(f"=== {sprite_id} (seeds {seeds}, symmetric={creature.symmetric}) ===")
            print(f"  Prompt   : {STYLE_PREFIX + creature.prompt}")
            print(f"  Negative : {NEGATIVE_PROMPT}")
            continue
        try:
            process(sprite_id, creature, seeds)
        except (RuntimeError, requests.RequestException) as error:
            print(f"[{sprite_id}] FAILED: {error}", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
