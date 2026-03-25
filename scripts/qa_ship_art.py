#!/usr/bin/env python3
"""qa_ship_art.py — Automated two-layer quality assurance for generated ship art.

Layer 1 (local, no API cost): Pillow checks — file size, dimensions, brightness, stddev.
Layer 2 (Claude Vision):      Semantic quality score 1-5; pass = score >= 3.

Usage:
  python scripts/qa_ship_art.py                     # full scan, all factions
  python scripts/qa_ship_art.py --skip-claude       # Layer 1 only
  python scripts/qa_ship_art.py --faction void_corsairs
  python scripts/qa_ship_art.py --requeue           # resubmit failed images
  python scripts/qa_ship_art.py --report-only       # print existing qa_report.json

Prerequisites:
  pip install pillow anthropic
  ANTHROPIC_API_KEY set in environment (unless --skip-claude)
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
ART_BASE = REPO_ROOT / 'public' / 'assets' / 'ships' / 'encyclopedia'
DATA_FILE = SCRIPT_DIR / 'ship_art_data.json'
REPORT_FILE = SCRIPT_DIR / 'qa_report.json'

MIN_FILE_SIZE_BYTES = 50_000    # 50 KB
EXPECTED_WIDTH = 768
EXPECTED_HEIGHT = 512
MIN_BRIGHTNESS = 20
MIN_STDDEV = 10
VISION_PASS_SCORE = 3
CLAUDE_MODEL = 'claude-opus-4-6'


# ---------------------------------------------------------------------------
# Layer 1 — Pillow checks (local, fast, no API cost)
# ---------------------------------------------------------------------------
def check_layer1(path: Path) -> dict[str, Any]:
    """Run Pillow-based technical checks on one image file.

    @param path - Absolute path to the PNG file.
    @returns dict with keys: pass (bool), failures (list[str]), file_size, dimensions.
    """
    from PIL import Image
    import statistics

    failures: list[str] = []

    file_size = path.stat().st_size
    if file_size < MIN_FILE_SIZE_BYTES:
        failures.append(f'file_size {file_size} < {MIN_FILE_SIZE_BYTES}')

    img = Image.open(path).convert('RGB')
    if img.size != (EXPECTED_WIDTH, EXPECTED_HEIGHT):
        failures.append(f'dimensions {img.size} != ({EXPECTED_WIDTH},{EXPECTED_HEIGHT})')

    pixels = list(img.getdata())
    flat = [v for rgb in pixels for v in rgb]
    mean_brightness = sum(flat) / len(flat)
    stddev = statistics.stdev(flat)

    if mean_brightness < MIN_BRIGHTNESS:
        failures.append(f'mean_brightness {mean_brightness:.1f} < {MIN_BRIGHTNESS}')
    if stddev < MIN_STDDEV:
        failures.append(f'stddev {stddev:.1f} < {MIN_STDDEV}')

    return {
        'pass': len(failures) == 0,
        'failures': failures,
        'file_size': file_size,
        'dimensions': list(img.size),
        'mean_brightness': round(mean_brightness, 2),
        'stddev': round(stddev, 2),
    }


# ---------------------------------------------------------------------------
# Layer 2 — Claude Vision semantic quality
# ---------------------------------------------------------------------------
def build_vision_prompt(ship_name: str, faction: str, role: str) -> str:
    """Build the Claude Vision evaluation prompt for one ship image.

    @param ship_name - Human-readable ship name.
    @param faction   - Faction identifier string.
    @param role      - Ship role (interceptor, bomber, etc.).
    @returns Prompt string requesting strict JSON response.
    """
    return (
        f'You are a game art quality reviewer. Evaluate this ship art image for '
        f'"{ship_name}" (faction: {faction}, role: {role}).\n\n'
        'Score the image 1-5 where:\n'
        '  5 = excellent cinematic concept art, clear spaceship, dramatic lighting\n'
        '  4 = good art, minor issues\n'
        '  3 = acceptable, some problems but usable\n'
        '  2 = poor quality, significant issues\n'
        '  1 = failed generation (black, noise, nonsense, no spaceship visible)\n\n'
        'Reply with ONLY valid JSON, no markdown:\n'
        '{"score": <int 1-5>, "issues": [<string>, ...], "pass": <bool>}\n'
        'Set pass=true if score >= 3.'
    )


def parse_vision_response(text: str) -> dict[str, Any]:
    """Parse Claude Vision JSON response, with regex fallback.

    @param text - Raw text response from Claude.
    @returns Parsed dict with score, issues, pass keys.
    @raises ValueError if no valid JSON object found.
    """
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        match = re.search(r'\{[^{}]+\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f'No JSON found in vision response: {text[:200]}')


def check_layer2(path: Path, ship: dict[str, str], client: Any) -> dict[str, Any]:
    """Run Claude Vision semantic quality check on one image.

    @param path   - Absolute path to the PNG file.
    @param ship   - Dict with name, faction, role keys.
    @param client - anthropic.Anthropic client instance.
    @returns dict with keys: pass, score, issues, raw_response.
    """
    with open(path, 'rb') as f:
        image_b64 = base64.standard_b64encode(f.read()).decode()

    prompt = build_vision_prompt(ship['name'], ship['faction'], ship['role'])
    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=256,
        messages=[{
            'role': 'user',
            'content': [
                {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': image_b64}},
                {'type': 'text', 'text': prompt},
            ],
        }],
    )
    raw = message.content[0].text
    parsed = parse_vision_response(raw)
    return {
        'pass': bool(parsed.get('pass', False)),
        'score': int(parsed.get('score', 0)),
        'issues': parsed.get('issues', []),
        'raw_response': raw,
    }


# ---------------------------------------------------------------------------
# Scanning + reporting
# ---------------------------------------------------------------------------
def load_ship_metadata() -> dict[str, dict[str, str]]:
    """Load ship metadata from ship_art_data.json, keyed by ship id.

    @returns Dict mapping ship_id → {id, name, faction, role}.
    """
    with open(DATA_FILE, encoding='utf-8') as f:
        ships: list[dict[str, str]] = json.load(f)['ships']
    return {s['id']: s for s in ships}


def scan_encyclopedia_art(faction_filter: str | None) -> list[Path]:
    """Find all generated encyclopedia art PNGs.

    @param faction_filter - If set, only return paths under that faction directory.
    @returns Sorted list of PNG paths.
    """
    base = ART_BASE
    if faction_filter:
        base = ART_BASE / faction_filter
    return sorted(base.rglob('*_art.png'))


def run_qa(
    paths: list[Path],
    ships_by_id: dict[str, dict[str, str]],
    skip_claude: bool,
) -> list[dict[str, Any]]:
    """Run both QA layers on each image path.

    @param paths       - List of PNG paths to evaluate.
    @param ships_by_id - Ship metadata keyed by id.
    @param skip_claude - When True, skip Layer 2 Claude Vision check.
    @returns List of result dicts (one per image).
    """
    client = None
    if not skip_claude:
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            print('ERROR: ANTHROPIC_API_KEY not set. Use --skip-claude for Layer 1 only.', file=sys.stderr)
            sys.exit(1)
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

    results: list[dict[str, Any]] = []
    for path in paths:
        ship_id = path.stem.removesuffix('_art')
        ship = ships_by_id.get(ship_id, {'id': ship_id, 'name': ship_id, 'faction': 'unknown', 'role': 'unknown'})

        result: dict[str, Any] = {'id': ship_id, 'path': str(path), 'ship': ship}
        l1 = check_layer1(path)
        result['layer1'] = l1

        if not skip_claude and l1['pass']:
            result['layer2'] = check_layer2(path, ship, client)
            result['overall_pass'] = l1['pass'] and result['layer2']['pass']
        else:
            result['layer2'] = None
            result['overall_pass'] = l1['pass']

        status = 'PASS' if result['overall_pass'] else 'FAIL'
        print(f"  [{status}] {ship_id}")
        results.append(result)

    return results


def generate_report(results: list[dict[str, Any]]) -> None:
    """Write QA results to qa_report.json.

    @param results - List of per-image result dicts from run_qa().
    """
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    print(f'\nReport written to {REPORT_FILE}')


def print_summary_table(results: list[dict[str, Any]]) -> None:
    """Print a human-readable pass/fail summary table.

    @param results - List of per-image result dicts from run_qa().
    """
    passed = [r for r in results if r['overall_pass']]
    failed = [r for r in results if not r['overall_pass']]
    print(f'\n{"=" * 60}')
    print(f'QA Summary: {len(passed)}/{len(results)} passed')
    if failed:
        print('\nFailed images:')
        for r in failed:
            l1_failures = r['layer1']['failures']
            l2_issues = r.get('layer2', {}) and r['layer2'] and r['layer2'].get('issues', [])
            reasons = l1_failures + (l2_issues or [])
            print(f'  {r["id"]}: {", ".join(reasons) if reasons else "layer2 fail"}')
    print(f'{"=" * 60}')


def requeue_failed(results: list[dict[str, Any]]) -> int:
    """Resubmit failed images to the SD queue via generate_ship_art.py.

    @param results - List of per-image result dicts from run_qa().
    @returns subprocess return code (0 = success).
    """
    failed_ids = [r['id'] for r in results if not r['overall_pass']]
    if not failed_ids:
        print('No failed images to requeue.')
        return 0
    print(f'Requeueing {len(failed_ids)} failed ships: {failed_ids}')
    env_json = json.dumps({'ships': [r['ship'] for r in results if not r['overall_pass']]})
    tmp = SCRIPT_DIR / '_requeue_tmp.json'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(env_json)
    result = subprocess.run(
        [sys.executable, str(SCRIPT_DIR / 'generate_ship_art.py'), '--data-file', str(tmp)],
        check=False,
    )
    tmp.unlink(missing_ok=True)
    return result.returncode


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> None:
    """Parse CLI arguments and run the QA pipeline."""
    parser = argparse.ArgumentParser(description='Automated ship art QA (Pillow + Claude Vision).')
    parser.add_argument('--skip-claude', action='store_true', help='Layer 1 only (no API cost)')
    parser.add_argument('--faction', metavar='FACTION_ID', help='Limit to one faction')
    parser.add_argument('--requeue', action='store_true', help='Resubmit failed images to SD queue')
    parser.add_argument('--report-only', action='store_true', help='Print existing qa_report.json and exit')
    args = parser.parse_args()

    if args.report_only:
        if not REPORT_FILE.exists():
            print(f'No report found at {REPORT_FILE}', file=sys.stderr)
            sys.exit(1)
        with open(REPORT_FILE, encoding='utf-8') as f:
            results: list[dict[str, Any]] = json.load(f)
        print_summary_table(results)
        return

    paths = scan_encyclopedia_art(args.faction)
    if not paths:
        print(f'No encyclopedia art found under {ART_BASE}', file=sys.stderr)
        sys.exit(1)

    ships_by_id = load_ship_metadata()
    print(f'Scanning {len(paths)} images (Layer 1{"" if args.skip_claude else " + Layer 2 Claude Vision"})...')
    results = run_qa(paths, ships_by_id, skip_claude=args.skip_claude)
    generate_report(results)
    print_summary_table(results)

    if args.requeue:
        requeue_failed(results)

    failed_count = sum(1 for r in results if not r['overall_pass'])
    if failed_count:
        sys.exit(1)


if __name__ == '__main__':
    main()
