#!/usr/bin/env python3
"""generate_ship_art.py — Generate cinematic encyclopedia art for all 100 ships.

Submits 768×512 landscape jobs to the shared SD queue server (port 8010).
Output: public/assets/ships/encyclopedia/{faction}/{ship_id}_art.png

Usage:
  python generate_ship_art.py                      # queue all 100 ships
  python generate_ship_art.py --faction void_corsairs
  python generate_ship_art.py --dry-run            # print prompts only

Prerequisites:
  - SD queue server running on port 8010
  - dreamshaper_8.safetensors checkpoint available
  - concept_art LoRA available
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_FILE = SCRIPT_DIR / 'ship_art_data.json'
OUTPUT_BASE = REPO_ROOT / 'public' / 'assets' / 'ships' / 'encyclopedia'

IMAGE_WIDTH = 768
IMAGE_HEIGHT = 512

# Faction scene descriptions — hangar atmosphere for each faction.
FACTION_SCENE: dict[str, str] = {
    'terran_hegemony': (
        'military space hangar, polished gray steel walls, uniformed Terran soldiers, '
        'harsh industrial lighting, imposing atmosphere, disciplined sci-fi military, '
        'Terran blue-and-silver color scheme, starfighter maintenance bay'
    ),
    'free_confederation': (
        'rebel asteroid base hangar, natural cave rock walls, diverse scrappy crew, '
        'improvised salvaged tech, warm amber overhead lighting, confederation orange markings, '
        'resourceful frontier atmosphere, mixed vessels'
    ),
    'synthetic_collective': (
        'deep space void, geometric neon-blue circuit patterns, zero organic crew, '
        'networked machine intelligence, crystalline drone formations, '
        'cold sterile void of space, synchronized drone swarm'
    ),
    'void_corsairs': (
        'space pirate dock, salvaged crimson-and-black hull panels, dark moody red lighting, '
        'outlaws and rogues, ramshackle jury-rigged technology, skull insignia, '
        'asteroid hideout hangar, danger and chaos'
    ),
    'ascendant_empire': (
        'sacred temple hangar, ornate golden columns, drifting incense hazes, '
        'robed divine figures, sacred geometry engravings, mystical green-and-gold light, '
        'ancient spiritual order starship bay'
    ),
}

# Role-specific combat context overlaid for action-oriented ships.
ROLE_COMBAT: dict[str, str] = {
    'interceptor':   'high-speed intercept maneuver, blazing afterburner contrails, sharp pursuit',
    'heavy_fighter': 'combat attack formation break, battle squadron engagement, weapons blazing',
    'bomber':        'payload ordnance release, weapons bay open, tactical bombing run, explosions',
    'gunship':       'broadside all-weapons engagement, turrets rotating and firing, sustained barrage',
    'capital':       'epic-scale capital warship in space, escort fighters flanking, command bridge lit',
}

NEGATIVE_PROMPT = (
    'text, watermark, blurry, low quality, jpeg artifacts, noise, '
    'person visible, crew portrait, anime style, cartoon, 3D CGI render, nsfw'
)


def build_prompt(ship: dict) -> str:
    """Build a faction- and role-specific cinematic prompt for one ship.

    @param ship - dict with keys: id, name, faction, role
    @returns SD positive prompt string
    """
    name = ship['name']
    faction = ship['faction']
    role = ship['role']
    scene = FACTION_SCENE[faction]
    combat = ROLE_COMBAT.get(role, '')

    # Action roles get the combat context in front; non-combat roles lean on hangar.
    if combat:
        context = f'{combat}, {scene.split(",")[0]}'
    else:
        context = scene

    return (
        '<lora:concept_art:0.60> '
        'masterpiece, cinematic concept art, wide landscape format, dramatic volumetric lighting, '
        f'{name.lower()} starship, {context}, '
        'detailed hull plating, engine exhaust glow, lens flare, '
        'cinematic composition, ultra detailed, 8k resolution'
    )


def make_jobs(ships: list[dict]) -> list[dict]:
    """Create one SD queue job dict per ship.

    @param ships - list of ship dicts from DataFile
    @returns list of job dicts compatible with sd_queue.py
    """
    jobs: list[dict] = []
    for ship in ships:
        out_dir = OUTPUT_BASE / ship['faction']
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{ship['id']}_art.png"
        jobs.append({
            'id': f"ship_art_{ship['id']}",
            'project': 'shattered-stars',
            'checkpoint': 'dreamshaper_8.safetensors',
            'lora': 'concept_art',
            'lora_weight': 0.60,
            'prompt': build_prompt(ship),
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
    """Write jobs to a temp file and call sd_queue.py submit.

    @param jobs - list of job dicts
    @returns subprocess return code
    """
    tmp = SCRIPT_DIR / '_ship_art_tmp.json'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, indent=2)
    result = subprocess.run(
        [sys.executable, str(SCRIPT_DIR / 'sd_queue.py'), 'submit', str(tmp)],
        check=False,
    )
    tmp.unlink(missing_ok=True)
    return result.returncode


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate ship encyclopedia art via SD queue.')
    parser.add_argument('--faction', metavar='FACTION_ID',
                        help='Limit generation to one faction (e.g. void_corsairs)')
    parser.add_argument('--id', dest='ship_id', metavar='SHIP_ID',
                        help='Limit generation to one ship (e.g. synth_gestalt)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Print prompts without submitting to the queue')
    args = parser.parse_args()

    with open(DATA_FILE, encoding='utf-8') as f:
        ships: list[dict] = json.load(f)['ships']

    if args.faction:
        ships = [s for s in ships if s['faction'] == args.faction]
        if not ships:
            print(f'No ships found for faction: {args.faction}', file=sys.stderr)
            sys.exit(1)

    if args.ship_id:
        ships = [s for s in ships if s['id'] == args.ship_id]
        if not ships:
            print(f'No ship found with id: {args.ship_id}', file=sys.stderr)
            sys.exit(1)

    jobs = make_jobs(ships)

    if args.dry_run:
        for job in jobs:
            print(f"\n=== {job['id']} ===")
            print(f"  Output : {job['output']}")
            print(f"  Prompt : {job['prompt']}")
        print(f'\n{len(jobs)} jobs total (dry run — not submitted)')
        return

    print(f'Submitting {len(jobs)} ship art jobs to SD queue...')
    rc = submit_jobs(jobs)
    if rc != 0:
        print('Submission failed. Is the SD queue server running on port 8010?', file=sys.stderr)
        sys.exit(rc)

    print(f'{len(jobs)} jobs queued.')
    print(f'Output directory: {OUTPUT_BASE}')
    print('Run "python scripts/sd_queue.py worker" to start processing.')


if __name__ == '__main__':
    main()
