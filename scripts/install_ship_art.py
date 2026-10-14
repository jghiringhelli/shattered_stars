#!/usr/bin/env python3
"""Install the chosen ship art into the game, keeping the old files in art-archive/ships-old/.

For every ship of ShipDefinitions it copies, from the batch output dir (--source):
    <source>/<faction>/chosen/<id>.png                  -> public/assets/ships/<faction>/<id>.png                 (512x512 RGBA)
    <source>/<faction>/chosen/encyclopedia/<id>_art.png -> public/assets/ships/encyclopedia/<faction>/<id>_art.png (768x512)
Each file is size-checked and optimised first (sprite < 300 KB, illustration < 400 KB; palette-quantised
only when a lossless optimise is not enough). An existing destination is archived (once, never overwritten)
to art-archive/ships-old/<same relative path> before it is replaced.

Usage:
    python scripts/install_ship_art.py --source DIR --dry-run     # list what would happen, change nothing
    python scripts/install_ship_art.py --source DIR               # archive old files, install new ones
"""
import argparse
import io
import shutil
import sys
from pathlib import Path
from typing import NamedTuple

from PIL import Image

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ship_roster_comfy import REPO, load_roster  # noqa: E402

SHIPS_DIR = REPO / "public" / "assets" / "ships"
ARCHIVE_DIR = REPO / "art-archive" / "ships-old"
SPRITE_PX, ILLUSTRATION_PX = (512, 512), (768, 512)
# Sprites keep a real RGBA alpha channel (tests/unit/assets/ShipArtAlpha.test.ts): palette
# quantisation roughened their transparent edges, so the budget fits lossless RGBA (~200 KB, as before).
SPRITE_LIMIT_BYTES, ILLUSTRATION_LIMIT_BYTES = 300 * 1024, 400 * 1024
PALETTE_STEPS = (256, 192, 128, 96, 64)


class Item(NamedTuple):
    source: Path
    destination: Path
    kind: str  # "sprite" or "illustration"


def plan(source: Path) -> list:
    """Every (source, destination, kind) of the roster, in roster order."""
    items = []
    for ship in load_roster():
        chosen = source / ship.faction / "chosen"
        items.append(Item(chosen / f"{ship.ship_id}.png", SHIPS_DIR / ship.faction / f"{ship.ship_id}.png", "sprite"))
        items.append(Item(chosen / "encyclopedia" / f"{ship.ship_id}_art.png",
                          SHIPS_DIR / "encyclopedia" / ship.faction / f"{ship.ship_id}_art.png", "illustration"))
    return items


def encode(image: Image.Image) -> bytes:
    """Lossless optimised PNG bytes."""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def optimise_png(image: Image.Image, limit_bytes: int) -> bytes:
    """PNG bytes under the limit: lossless first, then palette quantisation with fewer and fewer colours.

    :raises ValueError: when even the smallest palette does not fit.
    """
    data = encode(image)
    for colours in PALETTE_STEPS:
        if len(data) <= limit_bytes:
            return data
        quantised = image.quantize(colors=colours, method=Image.FASTOCTREE if image.mode == "RGBA" else Image.MEDIANCUT,
                                   dither=Image.FLOYDSTEINBERG)
        data = encode(quantised)
    if len(data) > limit_bytes:
        raise ValueError(f"{len(data) // 1024} KB exceeds the {limit_bytes // 1024} KB limit")
    return data


def check_and_encode(item: Item) -> bytes:
    """Validate dimensions/mode of a source file and return its optimised PNG bytes.

    :raises ValueError: on a wrong size/mode or when the size limit cannot be met.
    """
    if not item.source.exists():
        raise ValueError("source file missing")
    image = Image.open(item.source)
    expected_size = SPRITE_PX if item.kind == "sprite" else ILLUSTRATION_PX
    if image.size != expected_size:
        raise ValueError(f"size {image.size}, expected {expected_size}")
    if item.kind == "sprite":
        image = image.convert("RGBA")
        if image.getchannel("A").getextrema()[0] != 0:
            raise ValueError("sprite has no transparent pixels")
    else:
        image = image.convert("RGB")
    return optimise_png(image, SPRITE_LIMIT_BYTES if item.kind == "sprite" else ILLUSTRATION_LIMIT_BYTES)


def archive_old(item: Item) -> str:
    """Copy the current destination file to art-archive/ships-old/ unless it is already archived there."""
    if not item.destination.exists():
        return "no old file"
    target = ARCHIVE_DIR / item.destination.relative_to(SHIPS_DIR)
    if target.exists():
        return "already archived"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(item.destination, target)
    return "archived"


def main() -> int:
    """CLI entry point; exit code 1 when any file fails its checks (nothing is installed in that case)."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="batch output dir (generate_ship_art_comfy.py --out)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", default="", help="comma separated ship ids")
    args = parser.parse_args()
    only = set(filter(None, args.only.split(",")))
    items = [i for i in plan(Path(args.source)) if not only or i.destination.stem.removesuffix("_art") in only]
    encoded, problems = {}, []
    for item in items:
        try:
            encoded[item] = check_and_encode(item)
        except ValueError as error:
            problems.append(f"{item.destination.relative_to(SHIPS_DIR)}: {error}")
    for problem in problems:
        print(f"PROBLEM {problem}")
    if problems:
        print(f"{len(problems)} problem(s); nothing installed")
        return 1
    for item, data in encoded.items():
        note = "dry-run" if args.dry_run else archive_old(item)
        print(f"{item.destination.relative_to(SHIPS_DIR)}  {len(data) // 1024} KB  [{note}]")
        if not args.dry_run:
            item.destination.parent.mkdir(parents=True, exist_ok=True)
            item.destination.write_bytes(data)
    print(f"{len(encoded)} file(s) {'would be installed' if args.dry_run else 'installed'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
