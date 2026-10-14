#!/usr/bin/env python3
"""Contact sheets and a QC summary for the full ship-art batch (reads the batch output dir).

Writes <out>/sheet_<faction>.png (old vs new illustration and sprite per ship, one sheet per faction),
<out>/sheet_sprites_in_game.png (all chosen sprites at 48 px on a starfield) and prints the QC summary.

Usage:
    python scripts/ship_art_sheets.py --out DIR
"""
import argparse
import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ship_roster_comfy import REPO, load_roster  # noqa: E402

SHIPS_DIR = REPO / "public" / "assets" / "ships"
BACKDROP = (10, 12, 24)
ILLUSTRATION_CELL = (192, 128)
SPRITE_CELL = 128
GROUP_WIDTH = ILLUSTRATION_CELL[0] * 2 + SPRITE_CELL * 2
GROUP_COLUMNS = 2
INGAME_PX = 48
INGAME_COLUMNS = 11
INGAME_ZOOM = 2
STAR_COUNT = 400
LABEL_OK, LABEL_FAIL = (255, 235, 80), (255, 90, 90)


def on_backdrop(sprite: Image.Image, size: int) -> Image.Image:
    """Sprite scaled to size x size over the dark backdrop."""
    cell = Image.new("RGB", (size, size), BACKDROP)
    scaled = sprite.convert("RGBA").resize((size, size), Image.LANCZOS)
    cell.paste(scaled, (0, 0), scaled)
    return cell


def paste_ship(sheet: Image.Image, ship, out: Path, state: dict, origin: tuple) -> None:
    """Draw one ship's group: old illustration | new illustration | old sprite | new sprite."""
    x, y = origin
    old_art = Image.open(SHIPS_DIR / "encyclopedia" / ship.faction / f"{ship.ship_id}_art.png").convert("RGB")
    old_sprite = Image.open(SHIPS_DIR / ship.faction / f"{ship.ship_id}.png")
    chosen = out / ship.faction / "chosen"
    sheet.paste(old_art.resize(ILLUSTRATION_CELL), (x, y))
    if (chosen / "encyclopedia" / f"{ship.ship_id}_art.png").exists():
        new_art = Image.open(chosen / "encyclopedia" / f"{ship.ship_id}_art.png").convert("RGB")
        sheet.paste(new_art.resize(ILLUSTRATION_CELL), (x + ILLUSTRATION_CELL[0], y))
    sheet.paste(on_backdrop(old_sprite, SPRITE_CELL), (x + ILLUSTRATION_CELL[0] * 2, y))
    if (chosen / f"{ship.ship_id}.png").exists():
        sheet.paste(on_backdrop(Image.open(chosen / f"{ship.ship_id}.png"), SPRITE_CELL),
                    (x + ILLUSTRATION_CELL[0] * 2 + SPRITE_CELL, y))
    entry = state.get(ship.ship_id, {})
    flags = [f"{k}:{v['reason']}" for k, v in entry.items() if not v["ok"]]
    ImageDraw.Draw(sheet).text((x + 3, y + 3), ship.ship_id + (" FAIL " + ",".join(flags) if flags else ""),
                               fill=LABEL_FAIL if flags else LABEL_OK)


def faction_sheet(out: Path, faction: str, ships: list, state: dict) -> None:
    """One sheet per faction with every ship's old-vs-new group."""
    rows = -(-len(ships) // GROUP_COLUMNS)
    sheet = Image.new("RGB", (GROUP_WIDTH * GROUP_COLUMNS, SPRITE_CELL * rows), BACKDROP)
    for index, ship in enumerate(ships):
        paste_ship(sheet, ship, out, state, ((index % GROUP_COLUMNS) * GROUP_WIDTH, (index // GROUP_COLUMNS) * SPRITE_CELL))
    sheet.save(out / f"sheet_{faction}.png")


def ingame_sheet(out: Path, roster: list) -> None:
    """All chosen sprites at in-game size (48 px) on a starfield, one row group per faction."""
    rng = random.Random(7)
    factions = list(dict.fromkeys(s.faction for s in roster))
    lines = sum(-(-sum(1 for s in roster if s.faction == f) // INGAME_COLUMNS) for f in factions)
    pitch = INGAME_PX + 6
    field = Image.new("RGB", (INGAME_COLUMNS * pitch, lines * pitch), (4, 5, 14))
    draw = ImageDraw.Draw(field)
    for _ in range(STAR_COUNT):
        draw.point((rng.randrange(field.width), rng.randrange(field.height)), fill=(170, 180, 220))
    line = 0
    for faction in factions:
        ships = [s for s in roster if s.faction == faction]
        for index, ship in enumerate(ships):
            path = out / faction / "chosen" / f"{ship.ship_id}.png"
            if path.exists():
                sprite = Image.open(path).convert("RGBA").resize((INGAME_PX, INGAME_PX), Image.LANCZOS)
                field.paste(sprite, ((index % INGAME_COLUMNS) * pitch + 3, (line + index // INGAME_COLUMNS) * pitch + 3), sprite)
        line += -(-len(ships) // INGAME_COLUMNS)
    field = field.resize((field.width * INGAME_ZOOM, field.height * INGAME_ZOOM), Image.NEAREST)
    field.save(out / "sheet_sprites_in_game.png")


def summary(roster: list, state: dict) -> str:
    """Counts of chosen/QC-passing sprites and illustrations."""
    parts = []
    for kind in ("sprite", "illus"):
        made = sum(1 for s in roster if kind in state.get(s.ship_id, {}))
        passed = sum(1 for s in roster if state.get(s.ship_id, {}).get(kind, {}).get("ok"))
        parts.append(f"{kind}: {made}/{len(roster)} chosen, {passed} pass QC")
    return "; ".join(parts)


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    out = Path(parser.parse_args().out)
    roster = load_roster()
    state = json.loads((out / "state.json").read_text())
    for faction in dict.fromkeys(s.faction for s in roster):
        faction_sheet(out, faction, [s for s in roster if s.faction == faction], state)
    ingame_sheet(out, roster)
    print(summary(roster, state))
    for s in roster:
        for kind, v in state.get(s.ship_id, {}).items():
            if not v["ok"]:
                print(f"  FAIL {s.ship_id} {kind}: {v['reason']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
