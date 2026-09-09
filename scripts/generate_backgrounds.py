#!/usr/bin/env python3
"""generate_backgrounds.py — Generate painted space backgrounds (nebulae,
planets, a galaxy vista, a deep starfield) to replace/supplement the
procedural Phaser-graphics backgrounds in ParallaxBackground.ts / Starfield.ts.

Submits 1024x576 landscape jobs (matches the game's 1280x720 aspect ratio
exactly, so scaling up introduces no distortion) to the local SD queue.
Output: public/assets/backgrounds/<id>.png

Usage:
  python generate_backgrounds.py                # queue all backgrounds
  python generate_backgrounds.py --id nebula_blue
  python generate_backgrounds.py --dry-run       # print prompts only

Prerequisites:
  - Forge running on port 7860 (see docs/ASSET_GENERATION.md)
  - dreamshaper_8.safetensors checkpoint, concept_art LoRA available
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
OUTPUT_BASE = REPO_ROOT / 'public' / 'assets' / 'backgrounds'

IMAGE_WIDTH = 1024
IMAGE_HEIGHT = 576

NEGATIVE_PROMPT = (
    'text, watermark, blurry, low quality, jpeg artifacts, noise, '
    'ship, spaceship, starship, person, character, crew, anime style, '
    'cartoon, 3D CGI render, logo, ui, hud, nsfw, '
    'planet surface, ground, horizon, horizon line, mountains, desert, sand, terrain, '
    'landscape, land, foreground rocks, standing on surface, clouds, fog, mist, '
    'earth, ocean, sky, atmosphere, camera pointed up, looking up, milky way from earth'
)

BACKGROUNDS: list[dict] = [
    {
        'id': 'nebula_blue',
        'prompt': (
            'abstract cosmic nebula texture filling the entire frame, extreme close-up, '
            'electric blue and cyan gas clouds, dense star field, wispy tendrils, '
            'symmetrical composition, no horizon, no perspective, deep space background art, '
            'high detail'
        ),
    },
    {
        'id': 'nebula_purple',
        'prompt': (
            'abstract cosmic nebula texture filling the entire frame, extreme close-up, '
            'violet and magenta gas clouds, dense star field, swirling tendrils, '
            'symmetrical composition, no horizon, no perspective, deep space background art, '
            'high detail'
        ),
    },
    {
        'id': 'nebula_teal',
        'prompt': (
            'abstract cosmic nebula texture filling the entire frame, extreme close-up, '
            'teal and emerald gas clouds, dense star field, wispy tendrils, '
            'symmetrical composition, no horizon, no perspective, deep space background art, '
            'high detail'
        ),
    },
    {
        'id': 'nebula_crimson',
        'prompt': (
            'abstract cosmic nebula texture filling the entire frame, extreme close-up, '
            'crimson and orange gas clouds, dense star field, swirling tendrils, '
            'symmetrical composition, no horizon, no perspective, deep space background art, '
            'high detail'
        ),
    },
    {
        'id': 'planet_rocky',
        'prompt': (
            'a single small rocky planet sphere centered in a black void, isolated, '
            'cratered gray-brown surface, thin atmosphere glow at the rim, '
            'dense star field scattered around it, flat black background, '
            'video game background art, high detail, no horizon, no foreground'
        ),
    },
    {
        'id': 'planet_gas_giant',
        'prompt': (
            'a single gas giant planet sphere centered in a black void, isolated, '
            'photorealistic banded cloud surface texture, orange and cream horizontal bands, '
            'thin faint ring system, dense star field scattered around it, flat black background, '
            'video game background art, high detail, no horizon, no foreground'
        ),
    },
    {
        'id': 'planet_ice',
        'prompt': (
            'a single small ice planet sphere centered in a black void, isolated, '
            'cratered pale blue-white surface, thin icy atmosphere glow at the rim, '
            'dense star field scattered around it, flat black background, '
            'video game background art, high detail, no horizon, no foreground'
        ),
    },
    {
        'id': 'starfield_deep',
        'prompt': (
            'abstract star field texture filling the entire frame, thousands of stars of '
            'varying brightness, faint distant galaxies, flat black void gradient, '
            'symmetrical composition, no horizon, no perspective, video game background art, '
            'high detail'
        ),
    },
    {
        'id': 'galaxy_spiral',
        'prompt': (
            'a single spiral galaxy centered in a black void, isolated, luminous core, '
            'sweeping spiral arms, dense star field scattered around it, flat black background, '
            'video game background art, high detail, no horizon, no foreground'
        ),
    },
]


def build_prompt(bg: dict) -> str:
    """Builds the full positive prompt for one background.

    @param bg - dict with keys: id, prompt
    @returns SD positive prompt string
    """
    return (
        '<lora:concept_art:0.60> '
        'masterpiece, cinematic concept art, wide landscape format, '
        f"{bg['prompt']}, "
        'ultra detailed, 8k resolution'
    )


def make_jobs(backgrounds: list[dict]) -> list[dict]:
    """Creates one SD queue job dict per background.

    @param backgrounds - list of background dicts (id, prompt)
    @returns list of job dicts compatible with sd_queue.py
    """
    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)
    jobs: list[dict] = []
    for bg in backgrounds:
        out_path = OUTPUT_BASE / f"{bg['id']}.png"
        jobs.append({
            'id': f"background_{bg['id']}",
            'project': 'shattered-stars',
            'checkpoint': 'dreamshaper_8.safetensors',
            'lora': 'concept_art',
            'lora_weight': 0.60,
            'prompt': build_prompt(bg),
            'negative': NEGATIVE_PROMPT,
            'width': IMAGE_WIDTH,
            'height': IMAGE_HEIGHT,
            'steps': 28,
            'cfg': 7.0,
            'sampler': 'DPM++ 2M Karras',
            'seed': -1,
            'output': str(out_path.resolve()),
        })
    return jobs


def submit_jobs(jobs: list[dict]) -> int:
    """Writes jobs to a temp file and calls sd_queue.py submit.

    @param jobs - list of job dicts
    @returns subprocess return code
    """
    tmp = SCRIPT_DIR / '_backgrounds_tmp.json'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, indent=2)
    result = subprocess.run(
        [sys.executable, str(SCRIPT_DIR / 'sd_queue.py'), 'submit', str(tmp)],
        check=False,
    )
    tmp.unlink(missing_ok=True)
    return result.returncode


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate space backgrounds via SD queue.')
    parser.add_argument('--id', dest='bg_id', metavar='BACKGROUND_ID',
                        help='Limit generation to one background (e.g. nebula_blue)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Print prompts without submitting to the queue')
    args = parser.parse_args()

    backgrounds = BACKGROUNDS
    if args.bg_id:
        backgrounds = [b for b in backgrounds if b['id'] == args.bg_id]
        if not backgrounds:
            print(f'No background found with id: {args.bg_id}', file=sys.stderr)
            sys.exit(1)

    jobs = make_jobs(backgrounds)

    if args.dry_run:
        for job in jobs:
            print(f"\n=== {job['id']} ===")
            print(f"  Output : {job['output']}")
            print(f"  Prompt : {job['prompt']}")
        print(f'\n{len(jobs)} jobs total (dry run — not submitted)')
        return

    print(f'Submitting {len(jobs)} background jobs to SD queue...')
    rc = submit_jobs(jobs)
    if rc != 0:
        print('Submission failed. Is the SD queue server running on port 8010?', file=sys.stderr)
        sys.exit(rc)

    print(f'{len(jobs)} jobs queued.')
    print(f'Output directory: {OUTPUT_BASE}')
    print('Run "python scripts/direct_forge_worker.py" to render against Forge.')


if __name__ == '__main__':
    main()
