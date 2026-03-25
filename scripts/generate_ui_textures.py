#!/usr/bin/env python3
"""generate_ui_textures.py — Generate StarCraft-inspired UI textures via SD queue.

Submits six texture jobs to the shared SD queue server (port 8010).
Output: public/assets/ui/ui_*.png

Usage:
  python scripts/generate_ui_textures.py          # queue all 6 textures
  python scripts/generate_ui_textures.py --dry-run  # print prompts only
  python scripts/generate_ui_textures.py --force    # regenerate even if files exist

Prerequisites:
  - SD queue server running on port 8010
  - dreamshaper_8.safetensors checkpoint available
  - concept_art LoRA available
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = REPO_ROOT / 'public' / 'assets' / 'ui'

LORA_TAG = '<lora:concept_art:0.60>'
NEGATIVE_PROMPT = (
    'text, watermark, blurry, low quality, jpeg artifacts, noise, '
    'person, photograph, photorealistic, anime, cartoon, colorful, bright colors, '
    'fantasy, magic, organic shapes, natural, outdoors, nsfw'
)

# ---------------------------------------------------------------------------
# Texture definitions
# ---------------------------------------------------------------------------
TEXTURES: list[dict] = [
    {
        'key': 'ui_menu_bg',
        'filename': 'ui_menu_bg.png',
        'width': 1280,
        'height': 720,
        'prompt': (
            f'{LORA_TAG} masterpiece, cinematic concept art, '
            'deep space tactical command center interior, dark background with distant star field, '
            'subtle cyan holographic HUD grid overlay, dark blue-black nebula wisps, '
            'sci-fi military command bridge atmosphere, muted color palette, '
            'dark metal floor panels, minimal ambient lighting, ultra detailed, 8k'
        ),
    },
    {
        'key': 'ui_panel_bg',
        'filename': 'ui_panel_bg.png',
        'width': 512,
        'height': 256,
        'prompt': (
            f'{LORA_TAG} masterpiece, concept art, '
            'dark sci-fi metal panel texture, worn dark steel surface, '
            'subtle hexagonal geometric pattern embossed, rivets and seams, '
            'matte dark gunmetal finish, slight reflective sheen, '
            'tileable seamless surface, industrial military hardware, ultra detailed'
        ),
    },
    {
        'key': 'ui_title_frame',
        'filename': 'ui_title_frame.png',
        'width': 1280,
        'height': 160,
        'prompt': (
            f'{LORA_TAG} masterpiece, concept art, '
            'horizontal sci-fi tech banner frame, dark metal background, '
            'glowing cyan and orange accent lines along edges, angular geometric border, '
            'holographic circuit trace pattern, command display header bar, '
            'widescreen banner format, dramatic side lighting, ultra detailed'
        ),
    },
    {
        'key': 'ui_divider',
        'filename': 'ui_divider.png',
        'width': 512,
        'height': 32,
        'prompt': (
            f'{LORA_TAG} concept art, '
            'glowing cyan holographic separator line, thin horizontal bar, '
            'energy pulse glow effect, dark black background, '
            'sci-fi UI divider element, neon blue-cyan light streak, minimal design'
        ),
    },
    {
        'key': 'ui_button_normal',
        'filename': 'ui_button_normal.png',
        'width': 256,
        'height': 64,
        'prompt': (
            f'{LORA_TAG} concept art, '
            'dark sci-fi metal button panel, subtle beveled edge, '
            'matte dark steel surface with faint grid texture, '
            'dim amber edge highlight, military hardware aesthetic, '
            'rectangular UI button texture, dark theme, minimal glow'
        ),
    },
    {
        'key': 'ui_button_selected',
        'filename': 'ui_button_selected.png',
        'width': 256,
        'height': 64,
        'prompt': (
            f'{LORA_TAG} concept art, '
            'glowing cyan selected sci-fi button panel, bright holographic highlight, '
            'electric blue-cyan border glow, dark metal center, '
            'activated combat UI element, selected state indicator, '
            'rectangular button texture, dramatic cyan rim light'
        ),
    },
]


def make_jobs(force: bool) -> list[dict]:
    """Build SD queue job dicts for all UI textures.

    @param force - When True, include textures that already exist on disk.
    @returns List of job dicts compatible with sd_queue.py submit.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    jobs: list[dict] = []
    for tex in TEXTURES:
        out_path = OUTPUT_DIR / tex['filename']
        if out_path.exists() and not force:
            print(f'  [skip] {tex["key"]} already exists (use --force to regenerate)')
            continue
        jobs.append({
            'id': f"ui_tex_{tex['key']}",
            'project': 'shattered-stars',
            'checkpoint': 'dreamshaper_8.safetensors',
            'lora': 'concept_art',
            'lora_weight': 0.60,
            'prompt': tex['prompt'],
            'negative': NEGATIVE_PROMPT,
            'width': tex['width'],
            'height': tex['height'],
            'steps': 28,
            'cfg': 7.0,
            'sampler': 'DPM++ 2M Karras',
            'seed': -1,
            'output': str(out_path.resolve()),
        })
    return jobs


def submit_jobs(jobs: list[dict]) -> int:
    """Write jobs to a temp file and submit via sd_queue.py.

    @param jobs - List of job dicts to submit.
    @returns subprocess return code.
    """
    tmp = SCRIPT_DIR / '_ui_tex_tmp.json'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, indent=2)
    result = subprocess.run(
        [sys.executable, str(SCRIPT_DIR / 'sd_queue.py'), 'submit', str(tmp)],
        check=False,
    )
    tmp.unlink(missing_ok=True)
    return result.returncode


def main() -> None:
    """Parse CLI arguments and dispatch texture generation jobs."""
    parser = argparse.ArgumentParser(description='Generate StarCraft-inspired UI textures.')
    parser.add_argument('--dry-run', action='store_true', help='Print prompts without submitting')
    parser.add_argument('--force', action='store_true', help='Regenerate even if files exist')
    args = parser.parse_args()

    jobs = make_jobs(force=args.force)

    if not jobs:
        print('All textures already generated. Use --force to regenerate.')
        return

    if args.dry_run:
        for job in jobs:
            print(f"\n=== {job['id']} ({job['width']}x{job['height']}) ===")
            print(f"  Output : {job['output']}")
            print(f"  Prompt : {job['prompt']}")
        print(f'\n{len(jobs)} jobs total (dry run — not submitted)')
        return

    print(f'Submitting {len(jobs)} UI texture jobs to SD queue...')
    rc = submit_jobs(jobs)
    if rc != 0:
        print('Submission failed. Is the SD queue server running on port 8010?', file=sys.stderr)
        sys.exit(rc)

    print(f'{len(jobs)} jobs queued.')
    print(f'Output directory: {OUTPUT_DIR}')
    print('Load textures with: python scripts/sd_queue.py worker')


if __name__ == '__main__':
    main()
