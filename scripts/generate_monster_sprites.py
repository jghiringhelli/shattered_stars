#!/usr/bin/env python3
"""
Shattered Stars - Monster & Boss Sprite Generator

Generates sprite prompts and processes sprites for space monsters and boss ships.
Uses Stable Diffusion prompts optimized for sci-fi space creatures.

Usage:
    python generate_monster_sprites.py --prompts      # Generate SD prompts
    python generate_monster_sprites.py --process     # Process generated images
    python generate_monster_sprites.py --all         # Full pipeline
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

try:
    from PIL import Image, ImageFilter, ImageEnhance
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("WARNING: PIL/Pillow not found. Install with: pip install Pillow")

# =============================================================================
# CONFIGURATION
# =============================================================================

OUTPUT_DIR = Path("public/assets/monsters")
BOSS_DIR = Path("public/assets/bosses")
PROMPTS_DIR = Path("scripts/prompts")

# Monster sizes in pixels
MONSTER_SIZES = {
    "tiny": 16,
    "small": 24,
    "medium": 48,
    "large": 72,
    "huge": 96,
    "colossal": 160,
    "titan": 256,
}

# =============================================================================
# MONSTER DEFINITIONS (from SpaceMonsters.ts)
# =============================================================================

@dataclass
class MonsterDef:
    id: str
    name: str
    category: str
    size: str
    description: str
    visual_style: str  # Art direction for SD prompt

MONSTERS: List[MonsterDef] = [
    # Swarm creatures
    MonsterDef(
        id="void_mite",
        name="Void Mite",
        category="swarm",
        size="tiny",
        description="Tiny parasitic creatures that swarm in vast numbers",
        visual_style="insectoid, chitinous, multiple glowing eyes, small mandibles, dark carapace with bioluminescent spots, space parasite"
    ),
    MonsterDef(
        id="scourge_drone",
        name="Scourge Drone",
        category="swarm",
        size="small",
        description="Biological drones expelled from larger hive creatures",
        visual_style="organic spacecraft, ribbed bio-armor, trailing tentacles, acidic green glow, alien hive drone, biomechanical"
    ),
    MonsterDef(
        id="crystal_swarm",
        name="Crystal Swarm",
        category="swarm",
        size="small",
        description="Living crystalline organisms",
        visual_style="crystalline structure, geometric facets, prismatic colors, energy core, shattered glass appearance, luminous crystal creature"
    ),

    # Parasites
    MonsterDef(
        id="hull_borer",
        name="Hull Borer",
        category="parasite",
        size="small",
        description="Worm-like creatures that burrow through ship hulls",
        visual_style="segmented worm body, drilling mandibles, metallic sheen, mechanical-organic hybrid, space worm, industrial horror"
    ),
    MonsterDef(
        id="shield_leech",
        name="Shield Leech",
        category="parasite",
        size="medium",
        description="Energy parasites that drain shield energy",
        visual_style="translucent jellyfish-like, energy tendrils, electric blue glow, plasma veins, ethereal space jellyfish, energy absorber"
    ),
    MonsterDef(
        id="psi_stalker",
        name="Psi-Stalker",
        category="parasite",
        size="medium",
        description="Psychically attuned predators",
        visual_style="sleek predator form, third eye on forehead, neural tendrils, purple psionic aura, telepathic hunter, mind horror"
    ),

    # Leviathans (bosses)
    MonsterDef(
        id="void_whale",
        name="Void Whale",
        category="leviathan",
        size="colossal",
        description="Ancient space-faring creature of immense size",
        visual_style="massive whale-like form, cosmic barnacles, stellar dust clouds trailing, ancient eyes, nebula patterns on skin, space whale god"
    ),
    MonsterDef(
        id="star_serpent",
        name="Star Serpent",
        category="leviathan",
        size="titan",
        description="Legendary predator that hunts in stellar corona",
        visual_style="serpentine dragon body, solar flare mane, molten scales, plasma breath, corona wreath, stellar dragon, sun serpent"
    ),
    MonsterDef(
        id="kraken_prime",
        name="Kraken Prime",
        category="leviathan",
        size="titan",
        description="Multi-tentacled horror that can grab and crush ships",
        visual_style="massive octopoid form, armored tentacles, beak-like maw, void-black body, glowing suckers, cosmic kraken, ship crusher"
    ),

    # Void entities
    MonsterDef(
        id="rift_specter",
        name="Rift Specter",
        category="void_entity",
        size="medium",
        description="Ghostly entity that phases between dimensions",
        visual_style="ghostly translucent form, dimensional tears, phasing effect, spectral energy, reality distortion, ghost ship entity"
    ),
    MonsterDef(
        id="entropy_maw",
        name="Entropy Maw",
        category="void_entity",
        size="large",
        description="Living black hole that consumes matter",
        visual_style="event horizon circle, accretion disk, matter being consumed, gravitational lensing, void mouth, singularity creature"
    ),
    MonsterDef(
        id="null_herald",
        name="Null Herald",
        category="void_entity",
        size="huge",
        description="Harbinger of dimensional collapse",
        visual_style="geometric impossible shape, reality cracks, null void energy, herald form, eldritch geometry, dimension breaker"
    ),

    # Hive minds
    MonsterDef(
        id="brood_mother",
        name="Brood Mother",
        category="hive_mind",
        size="huge",
        description="Central hive organism that spawns drones",
        visual_style="bloated organic form, spawning pods, protective carapace, queen creature, hive central node, alien mother ship"
    ),
    MonsterDef(
        id="hive_nexus",
        name="Hive Nexus",
        category="hive_mind",
        size="colossal",
        description="The central brain of a hive fleet",
        visual_style="massive brain structure, neural tendrils extending, psionic crown, fleet coordinator, hive mind core, organic space station"
    ),
]

# =============================================================================
# FACTION BOSS SHIPS
# =============================================================================

@dataclass
class BossDef:
    id: str
    name: str
    faction: str
    size: str
    description: str
    visual_style: str

FACTION_BOSSES: List[BossDef] = [
    BossDef(
        id="terran_battlecruiser_boss",
        name="Hegemony Battlecruiser",
        faction="terran_hegemony",
        size="titan",
        description="Massive military battlecruiser flagship",
        visual_style="imperial battleship, angular military design, multiple gun batteries, bridge tower, blue engine glow, armor plating, terran warship"
    ),
    BossDef(
        id="confed_freedom_boss",
        name="Freedom Corvette",
        faction="free_confederation",
        size="colossal",
        description="Converted freighter rebel flagship",
        visual_style="converted cargo ship, improvised armor, rebel markings, orange accents, asymmetric design, freedom fighter vessel, makeshift warship"
    ),
    BossDef(
        id="synth_mothership_boss",
        name="Collective Mothership",
        faction="synthetic_collective",
        size="titan",
        description="Central AI processing hub vessel",
        visual_style="geometric perfect sphere, hexagonal panels, blue circuit patterns, antenna arrays, drone bays, AI mothership, machine hive"
    ),
    BossDef(
        id="corsair_mothership_boss",
        name="Pirate Mothership",
        faction="void_corsairs",
        size="colossal",
        description="Massive pirate carrier flagship",
        visual_style="cobbled together ship, skull markings, purple glow, weapon pods, salvage construction, pirate capital ship, void raider"
    ),
    BossDef(
        id="ascendant_dreadnought_boss",
        name="Ascendant Dreadnought",
        faction="ascendant_empire",
        size="titan",
        description="Living bio-ship dreadnought",
        visual_style="organic living ship, bio-armor plating, psionic tendrils, green bioluminescence, evolved warship, organic dreadnought, hive flagship"
    ),
]

# =============================================================================
# PROMPT GENERATION
# =============================================================================

def generate_sd_prompt(monster: MonsterDef) -> Dict:
    """Generate Stable Diffusion prompt for a monster"""

    base_style = "space creature, sci-fi, dark background, top-down view, game sprite, pixel art style, clean edges, no background"
    negative = "blurry, low quality, text, watermark, signature, human, realistic photo, 3d render"

    # Size affects detail level
    size_px = MONSTER_SIZES.get(monster.size, 64)
    if size_px <= 32:
        detail = "simple design, minimal detail, clear silhouette"
    elif size_px <= 96:
        detail = "moderate detail, defined features"
    else:
        detail = "highly detailed, intricate design, multiple features"

    prompt = f"{monster.visual_style}, {base_style}, {detail}"

    return {
        "id": monster.id,
        "name": monster.name,
        "category": monster.category,
        "size": monster.size,
        "size_px": size_px,
        "prompt": prompt,
        "negative_prompt": negative,
        "recommended_steps": 30,
        "recommended_cfg": 7.5,
        "recommended_size": max(512, size_px * 4),  # Generate at higher res, downscale
    }


def generate_boss_prompt(boss: BossDef) -> Dict:
    """Generate Stable Diffusion prompt for a faction boss"""

    base_style = "capital ship, massive spacecraft, sci-fi, dark space background, top-down view, game sprite, detailed, epic scale"
    negative = "blurry, low quality, text, watermark, signature, small ship, fighter"

    size_px = MONSTER_SIZES.get(boss.size, 256)

    prompt = f"{boss.visual_style}, {base_style}"

    return {
        "id": boss.id,
        "name": boss.name,
        "faction": boss.faction,
        "size": boss.size,
        "size_px": size_px,
        "prompt": prompt,
        "negative_prompt": negative,
        "recommended_steps": 40,
        "recommended_cfg": 7.0,
        "recommended_size": 512,
    }


def write_prompts():
    """Write all prompts to JSON files for SD generation"""
    PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

    # Monster prompts
    monster_prompts = [generate_sd_prompt(m) for m in MONSTERS]
    monster_file = PROMPTS_DIR / "monster_prompts.json"
    with open(monster_file, 'w') as f:
        json.dump(monster_prompts, f, indent=2)
    print(f"Wrote {len(monster_prompts)} monster prompts to {monster_file}")

    # Boss prompts
    boss_prompts = [generate_boss_prompt(b) for b in FACTION_BOSSES]
    boss_file = PROMPTS_DIR / "boss_prompts.json"
    with open(boss_file, 'w') as f:
        json.dump(boss_prompts, f, indent=2)
    print(f"Wrote {len(boss_prompts)} boss prompts to {boss_file}")

    # Combined markdown for easy viewing
    md_file = PROMPTS_DIR / "all_prompts.md"
    with open(md_file, 'w') as f:
        f.write("# Monster & Boss Sprite Generation Prompts\n\n")
        f.write("Use these prompts with Stable Diffusion to generate sprites.\n\n")

        f.write("## Monsters\n\n")
        for p in monster_prompts:
            f.write(f"### {p['name']} ({p['category']})\n")
            f.write(f"- **Size:** {p['size']} ({p['size_px']}px)\n")
            f.write(f"- **Prompt:** {p['prompt']}\n")
            f.write(f"- **Negative:** {p['negative_prompt']}\n")
            f.write(f"- **Settings:** {p['recommended_steps']} steps, CFG {p['recommended_cfg']}, {p['recommended_size']}x{p['recommended_size']}\n\n")

        f.write("## Faction Bosses\n\n")
        for p in boss_prompts:
            f.write(f"### {p['name']} ({p['faction']})\n")
            f.write(f"- **Size:** {p['size']} ({p['size_px']}px)\n")
            f.write(f"- **Prompt:** {p['prompt']}\n")
            f.write(f"- **Negative:** {p['negative_prompt']}\n")
            f.write(f"- **Settings:** {p['recommended_steps']} steps, CFG {p['recommended_cfg']}, {p['recommended_size']}x{p['recommended_size']}\n\n")

    print(f"Wrote combined prompts to {md_file}")


# =============================================================================
# IMAGE PROCESSING
# =============================================================================

def process_monster_image(input_path: Path, monster_id: str, target_size: int) -> Optional[Path]:
    """Process a generated monster image into game-ready sprite"""
    if not HAS_PIL:
        print("ERROR: PIL required for image processing")
        return None

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        img = Image.open(input_path)

        # Convert to RGBA if needed
        if img.mode != 'RGBA':
            img = img.convert('RGBA')

        # Resize to target size
        img = img.resize((target_size, target_size), Image.Resampling.LANCZOS)

        # Enhance for pixel art look
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.2)

        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.5)

        # Save
        output_path = OUTPUT_DIR / f"{monster_id}.png"
        img.save(output_path, "PNG")
        print(f"Processed: {output_path}")

        return output_path

    except Exception as e:
        print(f"ERROR processing {input_path}: {e}")
        return None


def create_monster_spritesheet(monster_id: str, base_image_path: Path, target_size: int) -> Optional[Path]:
    """Create a spritesheet with animation states for a monster"""
    if not HAS_PIL:
        return None

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        base = Image.open(base_image_path)
        if base.mode != 'RGBA':
            base = base.convert('RGBA')
        base = base.resize((target_size, target_size), Image.Resampling.LANCZOS)

        # Animation states for monsters: idle, attack, damaged, death
        states = ['idle', 'attack', 'damaged', 'death']
        frames_per_state = [2, 4, 2, 4]

        total_frames = sum(frames_per_state)
        sheet_width = target_size * max(frames_per_state)
        sheet_height = target_size * len(states)

        sheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))

        for row, (state, num_frames) in enumerate(zip(states, frames_per_state)):
            for frame in range(num_frames):
                # Create frame variant
                frame_img = base.copy()

                if state == 'idle':
                    # Subtle pulsing (brightness variation)
                    factor = 1.0 + (frame * 0.05)
                    enhancer = ImageEnhance.Brightness(frame_img)
                    frame_img = enhancer.enhance(factor)

                elif state == 'attack':
                    # Red/orange glow effect
                    overlay = Image.new('RGBA', frame_img.size, (255, 100, 0, int(50 + frame * 20)))
                    frame_img = Image.alpha_composite(frame_img, overlay)

                elif state == 'damaged':
                    # Red tint and reduced brightness
                    overlay = Image.new('RGBA', frame_img.size, (255, 0, 0, 60))
                    frame_img = Image.alpha_composite(frame_img, overlay)

                elif state == 'death':
                    # Fade out effect
                    alpha = int(255 * (1 - frame / num_frames))
                    r, g, b, a = frame_img.split()
                    a = a.point(lambda x: min(x, alpha))
                    frame_img = Image.merge('RGBA', (r, g, b, a))

                x = frame * target_size
                y = row * target_size
                sheet.paste(frame_img, (x, y))

        # Save spritesheet
        sheet_path = OUTPUT_DIR / f"{monster_id}_sheet.png"
        sheet.save(sheet_path, "PNG")

        # Save metadata
        metadata = {
            "monster_id": monster_id,
            "frame_width": target_size,
            "frame_height": target_size,
            "states": {
                state: {"row": i, "frames": frames, "y": i * target_size}
                for i, (state, frames) in enumerate(zip(states, frames_per_state))
            }
        }
        meta_path = OUTPUT_DIR / f"{monster_id}_sheet.json"
        with open(meta_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"Created spritesheet: {sheet_path}")
        return sheet_path

    except Exception as e:
        print(f"ERROR creating spritesheet for {monster_id}: {e}")
        return None


def process_all_monsters(input_dir: Path):
    """Process all monster images in a directory"""
    if not input_dir.exists():
        print(f"Input directory not found: {input_dir}")
        print("Please generate monster images first using the prompts.")
        return

    for monster in MONSTERS:
        # Look for the monster image
        possible_names = [
            f"{monster.id}.png",
            f"{monster.name.lower().replace(' ', '_')}.png",
            f"{monster.name.lower().replace(' ', '-')}.png",
        ]

        found = False
        for name in possible_names:
            input_path = input_dir / name
            if input_path.exists():
                target_size = MONSTER_SIZES.get(monster.size, 64)
                output = process_monster_image(input_path, monster.id, target_size)
                if output:
                    create_monster_spritesheet(monster.id, output, target_size)
                found = True
                break

        if not found:
            print(f"WARNING: No image found for {monster.id}")


def process_all_bosses(input_dir: Path):
    """Process all boss images in a directory"""
    BOSS_DIR.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        print(f"Input directory not found: {input_dir}")
        return

    for boss in FACTION_BOSSES:
        possible_names = [
            f"{boss.id}.png",
            f"{boss.name.lower().replace(' ', '_')}.png",
        ]

        found = False
        for name in possible_names:
            input_path = input_dir / name
            if input_path.exists():
                target_size = MONSTER_SIZES.get(boss.size, 256)
                # Process similar to monsters but save to boss dir
                if HAS_PIL:
                    try:
                        img = Image.open(input_path)
                        if img.mode != 'RGBA':
                            img = img.convert('RGBA')
                        img = img.resize((target_size, target_size), Image.Resampling.LANCZOS)

                        output_path = BOSS_DIR / f"{boss.id}.png"
                        img.save(output_path, "PNG")
                        print(f"Processed boss: {output_path}")
                        found = True
                    except Exception as e:
                        print(f"ERROR processing {boss.id}: {e}")
                break

        if not found:
            print(f"WARNING: No image found for {boss.id}")


# =============================================================================
# PLACEHOLDER GENERATION
# =============================================================================

def generate_placeholder_sprites():
    """Generate simple placeholder sprites for testing without SD"""
    if not HAS_PIL:
        print("ERROR: PIL required for placeholder generation")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    BOSS_DIR.mkdir(parents=True, exist_ok=True)

    # Monster category colors
    category_colors = {
        "swarm": (150, 200, 100),      # Green
        "parasite": (200, 100, 150),   # Pink
        "leviathan": (100, 150, 200),  # Blue
        "void_entity": (150, 100, 200),# Purple
        "hive_mind": (200, 150, 100),  # Orange
    }

    for monster in MONSTERS:
        size = MONSTER_SIZES.get(monster.size, 64)
        color = category_colors.get(monster.category, (150, 150, 150))

        # Create placeholder with shape based on category
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))

        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)

        # Draw shape
        margin = size // 8
        if monster.category == "swarm":
            # Small circle
            draw.ellipse([margin, margin, size-margin, size-margin], fill=color + (200,))
        elif monster.category == "leviathan":
            # Large oval
            draw.ellipse([margin//2, margin, size-margin//2, size-margin], fill=color + (220,))
        elif monster.category == "void_entity":
            # Diamond
            center = size // 2
            points = [(center, margin), (size-margin, center), (center, size-margin), (margin, center)]
            draw.polygon(points, fill=color + (180,))
        elif monster.category == "hive_mind":
            # Hexagon-ish
            draw.regular_polygon((size//2, size//2, size//2 - margin), 6, fill=color + (200,))
        else:
            # Default rectangle
            draw.rectangle([margin, margin, size-margin, size-margin], fill=color + (200,))

        # Save
        output_path = OUTPUT_DIR / f"{monster.id}.png"
        img.save(output_path, "PNG")
        print(f"Generated placeholder: {output_path}")

        # Also create spritesheet
        create_monster_spritesheet(monster.id, output_path, size)

    # Boss placeholders
    faction_colors = {
        "terran_hegemony": (50, 80, 150),
        "free_confederation": (255, 107, 53),
        "synthetic_collective": (0, 128, 255),
        "void_corsairs": (75, 0, 130),
        "ascendant_empire": (34, 139, 34),
    }

    for boss in FACTION_BOSSES:
        size = MONSTER_SIZES.get(boss.size, 256)
        color = faction_colors.get(boss.faction, (150, 150, 150))

        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)

        # Boss ships are large rectangles
        margin = size // 10
        draw.rectangle([margin, margin*2, size-margin, size-margin*2], fill=color + (220,))
        # Bridge
        draw.rectangle([size//3, margin, size*2//3, margin*3], fill=color + (255,))

        output_path = BOSS_DIR / f"{boss.id}.png"
        img.save(output_path, "PNG")
        print(f"Generated boss placeholder: {output_path}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Monster & Boss Sprite Generator")
    parser.add_argument("--prompts", action="store_true", help="Generate SD prompts")
    parser.add_argument("--process", type=Path, help="Process images from directory")
    parser.add_argument("--placeholders", action="store_true", help="Generate placeholder sprites")
    parser.add_argument("--all", action="store_true", help="Generate prompts and placeholders")

    args = parser.parse_args()

    if args.prompts or args.all:
        write_prompts()

    if args.placeholders or args.all:
        generate_placeholder_sprites()

    if args.process:
        process_all_monsters(args.process)
        process_all_bosses(args.process)

    if not any([args.prompts, args.process, args.placeholders, args.all]):
        parser.print_help()
        print("\nQuick start:")
        print("  python generate_monster_sprites.py --all")


if __name__ == "__main__":
    main()
