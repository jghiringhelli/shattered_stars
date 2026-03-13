#!/usr/bin/env python3
"""
Shattered Stars - Game Sprite Pipeline

Converts high-res SD-generated sprites to game-ready assets:
1. Pixelates to smaller sizes (64x64, 128x128) for performance
2. Generates spritesheets with animation states (idle, thrust, damaged)
3. Creates texture atlases for batch rendering
4. Preserves originals for ship registry/detail views

Usage:
    python create_game_sprites.py --pixelate          # Convert to pixel art
    python create_game_sprites.py --spritesheets     # Generate animation sheets
    python create_game_sprites.py --atlas            # Build texture atlases
    python create_game_sprites.py --all              # Full pipeline
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Optional, List, Tuple, Dict
from dataclasses import dataclass
from enum import Enum

try:
    import numpy as np
    from PIL import Image, ImageFilter, ImageEnhance
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("ERROR: PIL/Pillow required. Install with: pip install Pillow numpy")
    sys.exit(1)

import subprocess

# Aseprite CLI path
ASEPRITE_PATH = Path("C:/tools/aseprite/build/bin/aseprite.exe")

def check_aseprite() -> bool:
    """Check if Aseprite CLI is available"""
    if ASEPRITE_PATH.exists():
        return True
    # Also check PATH
    try:
        result = subprocess.run(["aseprite", "--version"],
                              capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except (subprocess.SubprocessError, FileNotFoundError):
        return False

HAS_ASEPRITE = check_aseprite()


# =============================================================================
# CONFIGURATION
# =============================================================================

# Directory structure
ORIGINAL_DIR = Path("public/assets/ships")           # High-res originals (512x512)
PIXEL_DIR = Path("public/assets/ships_pixel")        # Pixelated versions
SHEET_DIR = Path("public/assets/spritesheets")       # Animation spritesheets
ROTATION_DIR = Path("public/assets/rotations")       # Rotation spritesheets
ATLAS_DIR = Path("public/assets/atlases")            # Texture atlases
EFFECTS_DIR = Path("public/assets/effects")          # Effect spritesheets

# Sprite sizes for different use cases
class SpriteSize(Enum):
    ORIGINAL = 512      # Detail view, ship registry
    LARGE = 128         # Capital ships in battle
    MEDIUM = 64         # Standard ships in battle
    SMALL = 32          # Fighters, distant ships
    ICON = 16           # UI icons, minimap

# Animation states for ships
SHIP_STATES = [
    "idle",             # Base state, minimal animation
    "thrust",           # Engines active, moving
    "boost",            # Afterburner/sprint
    "damaged",          # Visual damage indicators
    "shields",          # Shield active effect
    "destroyed",        # Explosion sequence (multiple frames)
]

# Frames per state
FRAMES_PER_STATE = {
    "idle": 2,          # Subtle engine flicker
    "thrust": 4,        # Engine thrust animation
    "boost": 4,         # Intense afterburner
    "damaged": 2,       # Sparks/smoke variants
    "shields": 4,       # Shield shimmer
    "destroyed": 8,     # Explosion sequence
}

# Rotation configuration
ROTATION_CONFIG = {
    "directions": 16,       # Number of rotation frames (16 = 22.5° increments)
    "include_banking": True,  # Add slight tilt during turns
    "bank_angle": 5,        # Degrees of visual banking
}

# Factions
FACTIONS = [
    "terran_hegemony",
    "free_confederation",
    "synthetic_collective",
    "void_corsairs",
    "ascendant_empire"
]

# Ship size classes (affects which pixel size to use)
SHIP_SIZE_CLASSES = {
    # Epic capitals - use LARGE (128x128)
    "bastion": "epic", "battlecruiser": "epic", "dreadnought": "epic",
    "mothership": "epic", "corsair": "epic", "defiance": "epic",
    "nexus": "epic", "prime": "epic", "bio_cruiser": "epic",

    # Large ships - use LARGE (128x128)
    "cruiser": "large", "carrier": "large", "destroyer": "large",
    "leviathan": "large", "titan": "large", "fortress": "large",

    # Medium ships - use MEDIUM (64x64)
    "bomber": "medium", "gunship": "medium", "corvette": "medium",
    "frigate": "medium", "assault": "medium", "siege": "medium",
    "harbinger": "medium", "devastator": "medium", "reaver": "medium",

    # Small ships - use MEDIUM (64x64, they're important enough)
    "fighter": "small", "interceptor": "small", "scout": "small",
    "raider": "small", "drone": "small",
}


# =============================================================================
# PIXELATION FUNCTIONS
# =============================================================================

def get_ship_size_class(ship_id: str) -> str:
    """Determine ship size class from ID"""
    ship_name = ship_id.split('_', 1)[-1] if '_' in ship_id else ship_id

    for keyword, size_class in SHIP_SIZE_CLASSES.items():
        if keyword in ship_name.lower():
            return size_class

    # Default to small for unrecognized ships
    return "small"


def get_pixel_size(ship_id: str) -> int:
    """Get target pixel size based on ship class"""
    size_class = get_ship_size_class(ship_id)

    if size_class in ("epic", "large"):
        return SpriteSize.LARGE.value  # 128x128
    else:
        return SpriteSize.MEDIUM.value  # 64x64


def pixelate_image(
    img: Image.Image,
    target_size: int,
    enhance_colors: bool = True,
    sharpen: bool = True
) -> Image.Image:
    """
    Convert high-res image to pixel art style.

    Process:
    1. Downscale with LANCZOS for quality
    2. Optional color enhancement for pixel art pop
    3. Optional sharpening for crisp edges
    """
    # Ensure RGBA mode
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # Downscale to target size
    img_small = img.resize((target_size, target_size), Image.Resampling.LANCZOS)

    if enhance_colors:
        # Boost saturation slightly for pixel art look
        enhancer = ImageEnhance.Color(img_small)
        img_small = enhancer.enhance(1.15)

        # Boost contrast
        enhancer = ImageEnhance.Contrast(img_small)
        img_small = enhancer.enhance(1.1)

    if sharpen:
        # Sharpen edges for crisp pixel look
        img_small = img_small.filter(ImageFilter.SHARPEN)

    return img_small


def reduce_colors(img: Image.Image, num_colors: int = 32) -> Image.Image:
    """
    Reduce color palette for retro pixel art look.
    Preserves alpha channel.
    """
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # Split alpha
    r, g, b, a = img.split()
    rgb = Image.merge('RGB', (r, g, b))

    # Quantize colors
    rgb_quantized = rgb.quantize(colors=num_colors, method=Image.Quantize.MEDIANCUT)
    rgb_quantized = rgb_quantized.convert('RGB')

    # Recombine with alpha
    r, g, b = rgb_quantized.split()
    return Image.merge('RGBA', (r, g, b, a))


def process_sprite_to_pixel(
    input_path: Path,
    output_path: Path,
    target_size: int,
    reduce_palette: bool = False,
    palette_colors: int = 32
) -> bool:
    """Process a single sprite to pixel art"""
    try:
        img = Image.open(input_path)

        # Pixelate
        pixel_img = pixelate_image(img, target_size)

        # Optional palette reduction
        if reduce_palette:
            pixel_img = reduce_colors(pixel_img, palette_colors)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Save
        pixel_img.save(output_path, format='PNG')
        return True

    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def pixelate_all_sprites(
    factions: Optional[List[str]] = None,
    force: bool = False,
    reduce_palette: bool = False
):
    """Convert all high-res sprites to pixel art versions"""
    print("=" * 60)
    print("PIXELATING SPRITES")
    print("=" * 60)

    factions = factions or FACTIONS
    processed = 0
    skipped = 0
    failed = 0

    for faction in factions:
        faction_input = ORIGINAL_DIR / faction
        faction_output = PIXEL_DIR / faction

        if not faction_input.exists():
            print(f"\n[SKIP] {faction}: source directory not found")
            continue

        print(f"\n=== {faction.upper().replace('_', ' ')} ===")
        faction_output.mkdir(parents=True, exist_ok=True)

        for sprite_path in faction_input.glob("*.png"):
            ship_id = sprite_path.stem
            target_size = get_pixel_size(ship_id)
            output_path = faction_output / f"{ship_id}.png"

            # Skip if exists and not forcing
            if output_path.exists() and not force:
                print(f"  [SKIP] {ship_id} (exists)")
                skipped += 1
                continue

            print(f"  [PROC] {ship_id} -> {target_size}x{target_size}...", end=" ")

            if process_sprite_to_pixel(sprite_path, output_path, target_size, reduce_palette):
                print("OK")
                processed += 1
            else:
                print("FAILED")
                failed += 1

    print(f"\n=== Summary ===")
    print(f"Processed: {processed}")
    print(f"Skipped:   {skipped}")
    print(f"Failed:    {failed}")
    print(f"Output:    {PIXEL_DIR}")


# =============================================================================
# SPRITESHEET GENERATION
# =============================================================================

def create_thrust_frame(base_img: Image.Image, frame: int, total_frames: int) -> Image.Image:
    """Create a thrust animation frame with engine glow effect"""
    img = base_img.copy()
    arr = np.array(img)

    # Find engine area (bottom portion of ship)
    h, w = arr.shape[:2]
    engine_region = slice(int(h * 0.7), h)

    # Create pulsing glow effect
    pulse = 0.5 + 0.5 * np.sin(2 * np.pi * frame / total_frames)

    # Enhance blue/cyan channel in engine area for thrust glow
    engine_area = arr[engine_region, :, :]

    # Add blue tint proportional to pulse
    blue_boost = int(30 * pulse)
    engine_area[:, :, 2] = np.clip(engine_area[:, :, 2].astype(int) + blue_boost, 0, 255)

    # Brighten overall
    brightness_boost = int(20 * pulse)
    engine_area[:, :, :3] = np.clip(engine_area[:, :, :3].astype(int) + brightness_boost, 0, 255)

    arr[engine_region, :, :] = engine_area

    return Image.fromarray(arr)


def create_idle_frame(base_img: Image.Image, frame: int, total_frames: int) -> Image.Image:
    """Create subtle idle animation frame"""
    img = base_img.copy()

    # Very subtle brightness variation
    pulse = 0.98 + 0.04 * np.sin(2 * np.pi * frame / total_frames)

    enhancer = ImageEnhance.Brightness(img)
    return enhancer.enhance(pulse)


def create_damaged_frame(base_img: Image.Image, frame: int, total_frames: int) -> Image.Image:
    """Create damaged state with sparks/smoke effect"""
    img = base_img.copy()
    arr = np.array(img)

    # Add reddish tint to random areas
    h, w = arr.shape[:2]

    # Create damage overlay
    damage_mask = np.random.random((h, w)) > 0.95

    # Red/orange tint on damage points
    arr[damage_mask, 0] = np.clip(arr[damage_mask, 0].astype(int) + 100, 0, 255)
    arr[damage_mask, 1] = np.clip(arr[damage_mask, 1].astype(int) - 30, 0, 255)
    arr[damage_mask, 2] = np.clip(arr[damage_mask, 2].astype(int) - 50, 0, 255)

    return Image.fromarray(arr)


def create_shield_frame(base_img: Image.Image, frame: int, total_frames: int) -> Image.Image:
    """Create shield effect frame with energy shimmer"""
    img = base_img.copy()
    arr = np.array(img)

    h, w = arr.shape[:2]

    # Create shield shimmer wave
    wave_phase = 2 * np.pi * frame / total_frames
    y_coords = np.arange(h).reshape(-1, 1)

    # Sinusoidal wave across the image
    wave = np.sin(y_coords / 10 + wave_phase) * 0.5 + 0.5
    wave = np.tile(wave, (1, w))

    # Apply cyan/blue shield tint
    shield_intensity = 40
    arr[:, :, 1] = np.clip(arr[:, :, 1].astype(int) + (wave * shield_intensity).astype(int), 0, 255)
    arr[:, :, 2] = np.clip(arr[:, :, 2].astype(int) + (wave * shield_intensity).astype(int), 0, 255)

    return Image.fromarray(arr)


# =============================================================================
# ROTATION SPRITESHEET GENERATION
# =============================================================================

def create_rotation_frames(
    base_img: Image.Image,
    num_directions: int = 16,
    include_banking: bool = False,
    bank_angle: float = 5.0
) -> List[Image.Image]:
    """
    Create rotation frames for a ship sprite.

    Args:
        base_img: Base ship image (facing up/north)
        num_directions: Number of rotation frames (16 = 22.5° per frame)
        include_banking: Add visual tilt during turns
        bank_angle: Degrees of banking effect

    Returns:
        List of rotated frames, starting from 0° (up) going clockwise
    """
    frames = []
    angle_step = 360.0 / num_directions

    for i in range(num_directions):
        angle = i * angle_step

        # Rotate the image (negative because PIL rotates counter-clockwise)
        rotated = base_img.rotate(-angle, expand=False, resample=Image.Resampling.NEAREST,
                                   fillcolor=(0, 0, 0, 0))

        frames.append(rotated)

    return frames


def generate_rotation_spritesheet(
    base_img: Image.Image,
    ship_id: str,
    num_directions: int = 16
) -> Tuple[Image.Image, Dict]:
    """
    Generate a rotation spritesheet with all directional frames.

    Layout: Single row with all rotation frames
    Frame 0 = facing up (0°), increasing clockwise

    Returns (spritesheet_image, metadata_dict)
    """
    frame_w, frame_h = base_img.size

    # Generate rotation frames
    rotation_frames = create_rotation_frames(base_img, num_directions)

    # Create horizontal spritesheet
    sheet_w = frame_w * num_directions
    sheet_h = frame_h
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

    # Paste frames
    for i, frame in enumerate(rotation_frames):
        sheet.paste(frame, (i * frame_w, 0))

    # Metadata
    metadata = {
        "ship_id": ship_id,
        "type": "rotation",
        "frame_width": frame_w,
        "frame_height": frame_h,
        "directions": num_directions,
        "angle_per_frame": 360.0 / num_directions,
        "frames": [
            {"index": i, "angle": i * (360.0 / num_directions)}
            for i in range(num_directions)
        ]
    }

    return sheet, metadata


def create_explosion_with_ship(
    base_img: Image.Image,
    num_frames: int = 12,
    include_ship_breakup: bool = True
) -> List[Image.Image]:
    """
    Create explosion sequence that includes ship breaking apart.
    More visually interesting than pure fireball.
    """
    frames = []
    w, h = base_img.size
    base_arr = np.array(base_img)

    for i in range(num_frames):
        progress = i / (num_frames - 1)  # 0 to 1

        frame_arr = np.zeros((h, w, 4), dtype=np.uint8)

        if progress < 0.25:
            # Phase 1: Flash + ship still visible but brightening
            flash_intensity = progress / 0.25
            ship_arr = base_arr.copy()

            # Add white flash overlay
            flash = int(200 * flash_intensity)
            ship_arr[:, :, :3] = np.clip(ship_arr[:, :, :3].astype(int) + flash, 0, 255)

            frame_arr = ship_arr

        elif progress < 0.5:
            # Phase 2: Ship fragments + fireball forming
            local_progress = (progress - 0.25) / 0.25

            # Fireball
            center = (w // 2, h // 2)
            radius = int(w * 0.5 * local_progress)

            y, x = np.ogrid[:h, :w]
            dist = np.sqrt((x - center[0])**2 + (y - center[1])**2)

            mask = dist < radius
            intensity = np.zeros((h, w))
            intensity[mask] = 1 - dist[mask] / max(radius, 1)

            # Orange-red fireball
            frame_arr[:, :, 0] = (255 * intensity).astype(np.uint8)
            frame_arr[:, :, 1] = (150 * intensity * 0.8).astype(np.uint8)
            frame_arr[:, :, 2] = (50 * intensity * 0.3).astype(np.uint8)
            frame_arr[:, :, 3] = (255 * intensity).astype(np.uint8)

            # Add some ship fragments
            if include_ship_breakup:
                num_fragments = int(15 * (1 - local_progress))
                for _ in range(num_fragments):
                    fx = np.random.randint(w // 4, 3 * w // 4)
                    fy = np.random.randint(h // 4, 3 * h // 4)
                    if 0 <= fx < w and 0 <= fy < h:
                        # Use original ship colors for fragments
                        if base_arr[fy, fx, 3] > 100:  # If original pixel was visible
                            frame_arr[fy, fx] = base_arr[fy, fx]

        elif progress < 0.75:
            # Phase 3: Fireball expanding + fading
            local_progress = (progress - 0.5) / 0.25

            center = (w // 2, h // 2)
            radius = int(w * 0.5 * (1 + local_progress * 0.5))
            fade = 1 - local_progress * 0.5

            y, x = np.ogrid[:h, :w]
            dist = np.sqrt((x - center[0])**2 + (y - center[1])**2)

            mask = dist < radius
            intensity = np.zeros((h, w))
            intensity[mask] = (1 - dist[mask] / max(radius, 1)) * fade

            # Fading to orange/yellow
            frame_arr[:, :, 0] = (255 * intensity).astype(np.uint8)
            frame_arr[:, :, 1] = (200 * intensity).astype(np.uint8)
            frame_arr[:, :, 2] = (100 * intensity * 0.5).astype(np.uint8)
            frame_arr[:, :, 3] = (200 * intensity).astype(np.uint8)

        else:
            # Phase 4: Debris and smoke
            local_progress = (progress - 0.75) / 0.25
            fade = 1 - local_progress

            # Scattered debris particles
            num_particles = int(30 * fade)
            for _ in range(num_particles):
                px = np.random.randint(0, w)
                py = np.random.randint(0, h)

                # Debris colors (grays, oranges)
                color_choice = np.random.random()
                if color_choice < 0.3:
                    color = [255, 200, 100, int(180 * fade)]  # Hot debris
                elif color_choice < 0.6:
                    color = [150, 150, 150, int(150 * fade)]  # Gray debris
                else:
                    color = [100, 100, 100, int(100 * fade)]  # Dark smoke

                # Small particle
                for dy in range(-1, 2):
                    for dx in range(-1, 2):
                        if 0 <= px + dx < w and 0 <= py + dy < h:
                            frame_arr[py + dy, px + dx] = color

        frames.append(Image.fromarray(frame_arr))

    return frames


def create_warp_effect_frames(
    base_img: Image.Image,
    num_frames: int = 8,
    warp_in: bool = True
) -> List[Image.Image]:
    """
    Create warp/jump effect (ship appearing or disappearing).

    Args:
        base_img: Ship sprite
        num_frames: Animation length
        warp_in: True for warp-in, False for warp-out
    """
    frames = []
    w, h = base_img.size
    base_arr = np.array(base_img)

    for i in range(num_frames):
        progress = i / (num_frames - 1)
        if not warp_in:
            progress = 1 - progress

        frame_arr = np.zeros((h, w, 4), dtype=np.uint8)

        if progress < 0.3:
            # Phase 1: Streak/line effect
            local_progress = progress / 0.3

            # Vertical light streak
            center_x = w // 2
            streak_width = int(4 + 20 * (1 - local_progress))

            for x in range(max(0, center_x - streak_width), min(w, center_x + streak_width)):
                dist = abs(x - center_x) / max(streak_width, 1)
                intensity = (1 - dist) * local_progress

                # Blue-white warp color
                frame_arr[:, x, 0] = int(150 * intensity)
                frame_arr[:, x, 1] = int(200 * intensity)
                frame_arr[:, x, 2] = int(255 * intensity)
                frame_arr[:, x, 3] = int(255 * intensity)

        else:
            # Phase 2: Ship materializing with glow
            local_progress = (progress - 0.3) / 0.7

            # Ship fading in
            ship_alpha = local_progress
            glow_intensity = 1 - local_progress

            # Copy ship with adjusted alpha
            visible_mask = base_arr[:, :, 3] > 0
            frame_arr[visible_mask] = base_arr[visible_mask].copy()
            frame_arr[visible_mask, 3] = (frame_arr[visible_mask, 3] * ship_alpha).astype(np.uint8)

            # Add blue glow around ship
            if glow_intensity > 0:
                # Simple glow: brighten ship pixels
                frame_arr[visible_mask, 0] = np.clip(
                    frame_arr[visible_mask, 0].astype(int) + int(50 * glow_intensity), 0, 255
                ).astype(np.uint8)
                frame_arr[visible_mask, 1] = np.clip(
                    frame_arr[visible_mask, 1].astype(int) + int(100 * glow_intensity), 0, 255
                ).astype(np.uint8)
                frame_arr[visible_mask, 2] = np.clip(
                    frame_arr[visible_mask, 2].astype(int) + int(150 * glow_intensity), 0, 255
                ).astype(np.uint8)

        frames.append(Image.fromarray(frame_arr))

    return frames


def create_acceleration_frames(
    base_img: Image.Image,
    num_frames: int = 4,
    accelerating: bool = True
) -> List[Image.Image]:
    """
    Create acceleration/deceleration effect with engine trail.
    """
    frames = []
    w, h = base_img.size
    base_arr = np.array(base_img)

    for i in range(num_frames):
        progress = i / (num_frames - 1)
        if not accelerating:
            progress = 1 - progress

        frame_arr = base_arr.copy()

        # Find engine area (bottom of ship)
        engine_y_start = int(h * 0.7)

        # Add exhaust trail behind ship
        trail_length = int(h * 0.3 * progress)
        trail_intensity = 0.5 + 0.5 * progress

        for y in range(engine_y_start, min(h, engine_y_start + trail_length)):
            y_progress = (y - engine_y_start) / max(trail_length, 1)
            fade = (1 - y_progress) * trail_intensity

            # Find non-transparent pixels in this row of the ship
            row_mask = base_arr[min(engine_y_start, h-1), :, 3] > 100

            for x in range(w):
                if row_mask[x] or (w // 3 < x < 2 * w // 3):
                    # Blue-white exhaust
                    if y < h:
                        frame_arr[y, x, 0] = int(min(255, frame_arr[y, x, 0] + 100 * fade))
                        frame_arr[y, x, 1] = int(min(255, frame_arr[y, x, 1] + 150 * fade))
                        frame_arr[y, x, 2] = int(min(255, frame_arr[y, x, 2] + 255 * fade))
                        frame_arr[y, x, 3] = int(min(255, frame_arr[y, x, 3] + 200 * fade))

        # Brighten engine area
        engine_region = frame_arr[engine_y_start:, :, :]
        engine_region[:, :, 2] = np.clip(
            engine_region[:, :, 2].astype(int) + int(50 * progress), 0, 255
        ).astype(np.uint8)

        frames.append(Image.fromarray(frame_arr))

    return frames


def create_explosion_frames(base_img: Image.Image, num_frames: int = 8) -> List[Image.Image]:
    """Create explosion sequence frames"""
    frames = []
    h, w = base_img.size

    for i in range(num_frames):
        progress = i / (num_frames - 1)  # 0 to 1

        # Create explosion frame
        frame = Image.new('RGBA', (w, h), (0, 0, 0, 0))

        if progress < 0.3:
            # Early frames: ship breaking apart
            img = base_img.copy()
            arr = np.array(img)

            # Add bright flash
            flash = int(200 * (1 - progress / 0.3))
            arr[:, :, :3] = np.clip(arr[:, :, :3].astype(int) + flash, 0, 255)

            frame = Image.fromarray(arr)

        elif progress < 0.7:
            # Mid frames: fireball
            center = (w // 2, h // 2)
            radius = int(w * 0.4 * (progress - 0.3) / 0.4)

            arr = np.zeros((h, w, 4), dtype=np.uint8)

            # Create circular gradient
            y, x = np.ogrid[:h, :w]
            dist = np.sqrt((x - center[0])**2 + (y - center[1])**2)

            # Fire colors gradient
            mask = dist < radius
            intensity = 1 - dist[mask] / radius

            arr[mask, 0] = (255 * intensity).astype(np.uint8)  # Red
            arr[mask, 1] = (180 * intensity * 0.7).astype(np.uint8)  # Orange-ish
            arr[mask, 2] = (50 * intensity * 0.3).astype(np.uint8)
            arr[mask, 3] = (255 * intensity).astype(np.uint8)

            frame = Image.fromarray(arr)

        else:
            # Late frames: fading debris
            arr = np.zeros((h, w, 4), dtype=np.uint8)

            # Scattered debris particles
            num_particles = int(20 * (1 - progress))
            for _ in range(num_particles):
                px = np.random.randint(0, w)
                py = np.random.randint(0, h)

                # Small bright spots
                if 0 <= px < w and 0 <= py < h:
                    arr[py, px] = [255, 200, 100, int(255 * (1 - progress))]

            frame = Image.fromarray(arr)

        frames.append(frame)

    return frames


def generate_spritesheet(
    base_img: Image.Image,
    ship_id: str,
    states: List[str] = None
) -> Tuple[Image.Image, Dict]:
    """
    Generate a spritesheet with all animation states.
    Returns (spritesheet_image, metadata_dict)

    Layout: Each row is a state, columns are frames
    """
    states = states or ["idle", "thrust", "damaged", "shields"]

    frame_w, frame_h = base_img.size

    # Calculate sheet dimensions
    max_frames = max(FRAMES_PER_STATE.get(s, 4) for s in states)
    sheet_w = frame_w * max_frames
    sheet_h = frame_h * len(states)

    # Create sheet
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

    # Metadata for loading in game
    metadata = {
        "ship_id": ship_id,
        "frame_width": frame_w,
        "frame_height": frame_h,
        "states": {}
    }

    # Generate frames for each state
    for row, state in enumerate(states):
        num_frames = FRAMES_PER_STATE.get(state, 4)

        metadata["states"][state] = {
            "row": row,
            "frames": num_frames,
            "y": row * frame_h
        }

        for col in range(num_frames):
            # Generate frame based on state
            if state == "idle":
                frame = create_idle_frame(base_img, col, num_frames)
            elif state == "thrust":
                frame = create_thrust_frame(base_img, col, num_frames)
            elif state == "boost":
                frame = create_thrust_frame(base_img, col, num_frames)  # More intense
            elif state == "damaged":
                frame = create_damaged_frame(base_img, col, num_frames)
            elif state == "shields":
                frame = create_shield_frame(base_img, col, num_frames)
            elif state == "destroyed":
                explosion_frames = create_explosion_frames(base_img, num_frames)
                frame = explosion_frames[min(col, len(explosion_frames) - 1)]
            else:
                frame = base_img.copy()

            # Paste into sheet
            x = col * frame_w
            y = row * frame_h
            sheet.paste(frame, (x, y))

    return sheet, metadata


def generate_all_spritesheets(
    factions: Optional[List[str]] = None,
    use_pixel: bool = True,
    force: bool = False
):
    """Generate spritesheets for all ships"""
    print("=" * 60)
    print("GENERATING SPRITESHEETS")
    print("=" * 60)

    factions = factions or FACTIONS
    source_dir = PIXEL_DIR if use_pixel else ORIGINAL_DIR

    if use_pixel and not PIXEL_DIR.exists():
        print(f"ERROR: Pixel sprites not found at {PIXEL_DIR}")
        print("Run with --pixelate first, or use --no-pixel flag")
        return

    processed = 0
    skipped = 0

    all_metadata = {}

    for faction in factions:
        faction_input = source_dir / faction
        faction_output = SHEET_DIR / faction

        if not faction_input.exists():
            print(f"\n[SKIP] {faction}: source not found")
            continue

        print(f"\n=== {faction.upper().replace('_', ' ')} ===")
        faction_output.mkdir(parents=True, exist_ok=True)

        faction_metadata = {}

        for sprite_path in faction_input.glob("*.png"):
            ship_id = sprite_path.stem
            output_path = faction_output / f"{ship_id}_sheet.png"
            meta_path = faction_output / f"{ship_id}_sheet.json"

            if output_path.exists() and not force:
                print(f"  [SKIP] {ship_id} (exists)")
                skipped += 1
                continue

            print(f"  [GEN] {ship_id}...", end=" ", flush=True)

            try:
                base_img = Image.open(sprite_path).convert('RGBA')

                # Generate spritesheet
                sheet, metadata = generate_spritesheet(
                    base_img, ship_id,
                    states=["idle", "thrust", "damaged", "shields"]
                )

                # Save spritesheet
                sheet.save(output_path, format='PNG')

                # Save metadata
                with open(meta_path, 'w') as f:
                    json.dump(metadata, f, indent=2)

                faction_metadata[ship_id] = metadata
                print("OK")
                processed += 1

            except Exception as e:
                print(f"FAILED ({e})")

        all_metadata[faction] = faction_metadata

    # Save combined metadata
    combined_meta_path = SHEET_DIR / "all_ships.json"
    with open(combined_meta_path, 'w') as f:
        json.dump(all_metadata, f, indent=2)

    print(f"\n=== Summary ===")
    print(f"Generated: {processed}")
    print(f"Skipped:   {skipped}")
    print(f"Output:    {SHEET_DIR}")
    print(f"Metadata:  {combined_meta_path}")


def generate_all_rotations(
    factions: Optional[List[str]] = None,
    use_pixel: bool = True,
    force: bool = False,
    num_directions: int = 16
):
    """Generate rotation spritesheets for all ships"""
    print("=" * 60)
    print("GENERATING ROTATION SPRITESHEETS")
    print("=" * 60)
    print(f"  Directions: {num_directions} ({360/num_directions}° per frame)")

    factions = factions or FACTIONS
    source_dir = PIXEL_DIR if use_pixel else ORIGINAL_DIR

    if use_pixel and not PIXEL_DIR.exists():
        print(f"ERROR: Pixel sprites not found at {PIXEL_DIR}")
        print("Run with --pixelate first, or use --no-pixel flag")
        return

    processed = 0
    skipped = 0

    all_metadata = {}

    for faction in factions:
        faction_input = source_dir / faction
        faction_output = ROTATION_DIR / faction

        if not faction_input.exists():
            print(f"\n[SKIP] {faction}: source not found")
            continue

        print(f"\n=== {faction.upper().replace('_', ' ')} ===")
        faction_output.mkdir(parents=True, exist_ok=True)

        faction_metadata = {}

        for sprite_path in faction_input.glob("*.png"):
            ship_id = sprite_path.stem
            output_path = faction_output / f"{ship_id}_rot.png"
            meta_path = faction_output / f"{ship_id}_rot.json"

            if output_path.exists() and not force:
                print(f"  [SKIP] {ship_id} (exists)")
                skipped += 1
                continue

            print(f"  [GEN] {ship_id}...", end=" ", flush=True)

            try:
                base_img = Image.open(sprite_path).convert('RGBA')

                # Generate rotation spritesheet
                sheet, metadata = generate_rotation_spritesheet(
                    base_img, ship_id, num_directions
                )

                # Save spritesheet
                sheet.save(output_path, format='PNG')

                # Save metadata
                with open(meta_path, 'w') as f:
                    json.dump(metadata, f, indent=2)

                faction_metadata[ship_id] = metadata
                print("OK")
                processed += 1

            except Exception as e:
                print(f"FAILED ({e})")

        all_metadata[faction] = faction_metadata

    # Save combined metadata
    combined_meta_path = ROTATION_DIR / "all_rotations.json"
    ROTATION_DIR.mkdir(parents=True, exist_ok=True)
    with open(combined_meta_path, 'w') as f:
        json.dump(all_metadata, f, indent=2)

    print(f"\n=== Summary ===")
    print(f"Generated: {processed}")
    print(f"Skipped:   {skipped}")
    print(f"Output:    {ROTATION_DIR}")
    print(f"Metadata:  {combined_meta_path}")


def generate_ship_explosion_sheets(
    factions: Optional[List[str]] = None,
    use_pixel: bool = True,
    force: bool = False,
    num_frames: int = 12
):
    """Generate explosion animation sheets for all ships"""
    print("=" * 60)
    print("GENERATING EXPLOSION SPRITESHEETS")
    print("=" * 60)
    print(f"  Frames: {num_frames}")

    factions = factions or FACTIONS
    source_dir = PIXEL_DIR if use_pixel else ORIGINAL_DIR
    explosion_dir = SHEET_DIR / "explosions"

    if use_pixel and not PIXEL_DIR.exists():
        print(f"ERROR: Pixel sprites not found at {PIXEL_DIR}")
        return

    processed = 0
    skipped = 0

    for faction in factions:
        faction_input = source_dir / faction
        faction_output = explosion_dir / faction

        if not faction_input.exists():
            print(f"\n[SKIP] {faction}: source not found")
            continue

        print(f"\n=== {faction.upper().replace('_', ' ')} ===")
        faction_output.mkdir(parents=True, exist_ok=True)

        for sprite_path in faction_input.glob("*.png"):
            ship_id = sprite_path.stem
            output_path = faction_output / f"{ship_id}_explosion.png"
            meta_path = faction_output / f"{ship_id}_explosion.json"

            if output_path.exists() and not force:
                print(f"  [SKIP] {ship_id} (exists)")
                skipped += 1
                continue

            print(f"  [GEN] {ship_id}...", end=" ", flush=True)

            try:
                base_img = Image.open(sprite_path).convert('RGBA')
                frame_w, frame_h = base_img.size

                # Generate explosion frames
                explosion_frames = create_explosion_with_ship(base_img, num_frames)

                # Create horizontal spritesheet
                sheet_w = frame_w * num_frames
                sheet = Image.new('RGBA', (sheet_w, frame_h), (0, 0, 0, 0))

                for i, frame in enumerate(explosion_frames):
                    sheet.paste(frame, (i * frame_w, 0))

                # Save
                sheet.save(output_path, format='PNG')

                # Metadata
                metadata = {
                    "ship_id": ship_id,
                    "type": "explosion",
                    "frame_width": frame_w,
                    "frame_height": frame_h,
                    "frames": num_frames,
                    "loop": False
                }
                with open(meta_path, 'w') as f:
                    json.dump(metadata, f, indent=2)

                print("OK")
                processed += 1

            except Exception as e:
                print(f"FAILED ({e})")

    print(f"\n=== Summary ===")
    print(f"Generated: {processed}")
    print(f"Skipped:   {skipped}")
    print(f"Output:    {explosion_dir}")


# =============================================================================
# ASEPRITE INTEGRATION
# =============================================================================

def get_aseprite_cmd() -> str:
    """Get Aseprite command (path or from PATH)"""
    if ASEPRITE_PATH.exists():
        return str(ASEPRITE_PATH)
    return "aseprite"


def aseprite_create_spritesheet(
    input_paths: List[Path],
    output_path: Path,
    sheet_type: str = "horizontal",
    frame_width: int = None,
    frame_height: int = None
) -> bool:
    """
    Use Aseprite CLI to create a spritesheet from multiple images.

    Args:
        input_paths: List of frame image paths
        output_path: Output spritesheet path
        sheet_type: "horizontal", "vertical", or "packed"
        frame_width: Optional frame width override
        frame_height: Optional frame height override
    """
    if not HAS_ASEPRITE:
        print("  WARNING: Aseprite not available, using PIL fallback")
        return False

    cmd = [get_aseprite_cmd(), "--batch"]

    # Add input files
    for path in input_paths:
        cmd.extend(["--layer", str(path)])

    # Sheet options
    if sheet_type == "horizontal":
        cmd.extend(["--sheet-type", "horizontal"])
    elif sheet_type == "vertical":
        cmd.extend(["--sheet-type", "vertical"])
    else:
        cmd.extend(["--sheet-type", "packed"])

    # Output
    cmd.extend(["--sheet", str(output_path)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.returncode == 0
    except subprocess.SubprocessError as e:
        print(f"  Aseprite error: {e}")
        return False


def aseprite_resize_sprite(
    input_path: Path,
    output_path: Path,
    width: int,
    height: int,
    scale_mode: str = "nearest"
) -> bool:
    """
    Use Aseprite to resize a sprite with proper pixel art scaling.

    Args:
        input_path: Source image
        output_path: Destination image
        width: Target width
        height: Target height
        scale_mode: "nearest" (pixel perfect) or "bilinear"
    """
    if not HAS_ASEPRITE:
        return False

    cmd = [
        get_aseprite_cmd(), "--batch",
        str(input_path),
        "--scale", str(width / 512),  # Assuming 512 source
        "--save-as", str(output_path)
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.returncode == 0
    except subprocess.SubprocessError:
        return False


def aseprite_export_animation(
    aseprite_file: Path,
    output_sheet: Path,
    output_json: Path = None
) -> bool:
    """
    Export an Aseprite file to spritesheet with JSON data.
    """
    if not HAS_ASEPRITE:
        return False

    cmd = [
        get_aseprite_cmd(), "--batch",
        str(aseprite_file),
        "--sheet", str(output_sheet),
        "--sheet-type", "horizontal",
        "--format", "json-array"
    ]

    if output_json:
        cmd.extend(["--data", str(output_json)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.returncode == 0
    except subprocess.SubprocessError:
        return False


def pixelate_with_aseprite(
    input_path: Path,
    output_path: Path,
    target_size: int
) -> bool:
    """
    Use Aseprite for high-quality pixel art downscaling.
    Falls back to PIL if Aseprite not available.
    """
    if not HAS_ASEPRITE:
        # Fallback to PIL
        return process_sprite_to_pixel(input_path, output_path, target_size)

    # Calculate scale factor (assuming 512x512 source)
    scale = target_size / 512

    cmd = [
        get_aseprite_cmd(), "--batch",
        str(input_path),
        "--scale", str(scale),
        "--save-as", str(output_path)
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return True
        else:
            # Fallback to PIL on failure
            return process_sprite_to_pixel(input_path, output_path, target_size)
    except subprocess.SubprocessError:
        return process_sprite_to_pixel(input_path, output_path, target_size)


# =============================================================================
# TEXTURE ATLAS BUILDER
# =============================================================================

def build_texture_atlas(
    factions: Optional[List[str]] = None,
    max_size: int = 4096,
    use_pixel: bool = True
):
    """
    Build texture atlases for efficient batch rendering.
    Groups sprites by faction into atlas textures.
    """
    print("=" * 60)
    print("BUILDING TEXTURE ATLASES")
    print("=" * 60)

    factions = factions or FACTIONS
    source_dir = PIXEL_DIR if use_pixel else ORIGINAL_DIR

    ATLAS_DIR.mkdir(parents=True, exist_ok=True)

    for faction in factions:
        faction_input = source_dir / faction

        if not faction_input.exists():
            print(f"\n[SKIP] {faction}: source not found")
            continue

        print(f"\n=== {faction.upper().replace('_', ' ')} ===")

        # Collect all sprites
        sprites = []
        for sprite_path in sorted(faction_input.glob("*.png")):
            img = Image.open(sprite_path).convert('RGBA')
            sprites.append({
                'id': sprite_path.stem,
                'img': img,
                'w': img.width,
                'h': img.height
            })

        if not sprites:
            print("  No sprites found")
            continue

        # Simple row-based packing
        # (For production, use a proper bin-packing algorithm)
        current_x = 0
        current_y = 0
        row_height = 0
        positions = []

        for sprite in sprites:
            if current_x + sprite['w'] > max_size:
                # Start new row
                current_x = 0
                current_y += row_height
                row_height = 0

            if current_y + sprite['h'] > max_size:
                print(f"  WARNING: Atlas overflow, some sprites won't fit")
                break

            positions.append({
                'id': sprite['id'],
                'x': current_x,
                'y': current_y,
                'w': sprite['w'],
                'h': sprite['h']
            })

            row_height = max(row_height, sprite['h'])
            current_x += sprite['w']

        # Calculate final atlas size (power of 2)
        atlas_w = 1
        atlas_h = 1
        max_x = max(p['x'] + p['w'] for p in positions)
        max_y = max(p['y'] + p['h'] for p in positions)

        while atlas_w < max_x:
            atlas_w *= 2
        while atlas_h < max_y:
            atlas_h *= 2

        # Create atlas
        atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))

        for sprite, pos in zip(sprites, positions):
            atlas.paste(sprite['img'], (pos['x'], pos['y']))
            print(f"  [PACK] {sprite['id']} @ ({pos['x']}, {pos['y']})")

        # Save atlas
        atlas_path = ATLAS_DIR / f"{faction}_atlas.png"
        atlas.save(atlas_path, format='PNG')

        # Save atlas metadata
        atlas_meta = {
            'faction': faction,
            'width': atlas_w,
            'height': atlas_h,
            'sprites': positions
        }

        meta_path = ATLAS_DIR / f"{faction}_atlas.json"
        with open(meta_path, 'w') as f:
            json.dump(atlas_meta, f, indent=2)

        print(f"  Atlas: {atlas_w}x{atlas_h}, {len(positions)} sprites")

    print(f"\n=== Summary ===")
    print(f"Output: {ATLAS_DIR}")


# =============================================================================
# EFFECT SPRITESHEETS
# =============================================================================

def generate_explosion_sheet(sizes: List[int] = None, frames: int = 12):
    """Generate explosion effect spritesheet"""
    print("\n=== GENERATING EXPLOSION EFFECTS ===")

    sizes = sizes or [32, 64, 128]
    EFFECTS_DIR.mkdir(parents=True, exist_ok=True)

    for size in sizes:
        print(f"  Explosion {size}x{size}...", end=" ")

        # Create placeholder sprite for explosion generation
        placeholder = Image.new('RGBA', (size, size), (0, 0, 0, 0))

        explosion_frames = create_explosion_frames(placeholder, frames)

        # Create horizontal spritesheet
        sheet_w = size * frames
        sheet_h = size
        sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

        for i, frame in enumerate(explosion_frames):
            sheet.paste(frame, (i * size, 0))

        # Save
        sheet_path = EFFECTS_DIR / f"explosion_{size}.png"
        sheet.save(sheet_path, format='PNG')

        # Metadata
        meta = {
            'effect': 'explosion',
            'size': size,
            'frames': frames,
            'frame_width': size,
            'frame_height': size
        }
        meta_path = EFFECTS_DIR / f"explosion_{size}.json"
        with open(meta_path, 'w') as f:
            json.dump(meta, f, indent=2)

        print("OK")


def generate_thruster_sheet(sizes: List[int] = None, frames: int = 8):
    """Generate thruster/engine glow effect spritesheet"""
    print("\n=== GENERATING THRUSTER EFFECTS ===")

    sizes = sizes or [16, 32, 64]
    EFFECTS_DIR.mkdir(parents=True, exist_ok=True)

    for size in sizes:
        print(f"  Thruster {size}x{size}...", end=" ")

        sheet_w = size * frames
        sheet_h = size
        sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

        for i in range(frames):
            # Create flame/glow frame
            frame = Image.new('RGBA', (size, size), (0, 0, 0, 0))
            arr = np.array(frame)

            h, w = size, size
            center_x, center_y = w // 2, 0  # Top center (thruster base)

            # Create flame shape
            y, x = np.ogrid[:h, :w]

            # Elongated flame pointing down
            flame_shape = ((x - center_x) ** 2 / (size/4)**2 +
                          (y - center_y) ** 2 / (size/1.5)**2)

            # Pulsing intensity
            pulse = 0.7 + 0.3 * np.sin(2 * np.pi * i / frames)

            # Create gradient
            mask = flame_shape < 1
            intensity = (1 - flame_shape[mask]) * pulse

            # Blue-white flame colors
            arr[mask, 0] = (100 + 155 * intensity).astype(np.uint8)  # R
            arr[mask, 1] = (150 + 105 * intensity).astype(np.uint8)  # G
            arr[mask, 2] = (255 * np.ones_like(intensity)).astype(np.uint8)  # B
            arr[mask, 3] = (200 * intensity).astype(np.uint8)  # A

            frame = Image.fromarray(arr)
            sheet.paste(frame, (i * size, 0))

        # Save
        sheet_path = EFFECTS_DIR / f"thruster_{size}.png"
        sheet.save(sheet_path, format='PNG')

        meta = {
            'effect': 'thruster',
            'size': size,
            'frames': frames,
            'frame_width': size,
            'frame_height': size,
            'loop': True
        }
        meta_path = EFFECTS_DIR / f"thruster_{size}.json"
        with open(meta_path, 'w') as f:
            json.dump(meta, f, indent=2)

        print("OK")


def generate_shield_hit_sheet(sizes: List[int] = None, frames: int = 6):
    """Generate shield impact effect spritesheet"""
    print("\n=== GENERATING SHIELD HIT EFFECTS ===")

    sizes = sizes or [64, 128]
    EFFECTS_DIR.mkdir(parents=True, exist_ok=True)

    for size in sizes:
        print(f"  Shield hit {size}x{size}...", end=" ")

        sheet_w = size * frames
        sheet_h = size
        sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

        for i in range(frames):
            progress = i / (frames - 1)

            frame = Image.new('RGBA', (size, size), (0, 0, 0, 0))
            arr = np.array(frame)

            h, w = size, size
            center = size // 2

            # Expanding ring effect
            y, x = np.ogrid[:h, :w]
            dist = np.sqrt((x - center)**2 + (y - center)**2)

            # Ring parameters
            ring_radius = size * 0.3 * (1 + progress)
            ring_width = size * 0.1 * (1 - progress * 0.5)

            # Create ring mask
            ring_mask = np.abs(dist - ring_radius) < ring_width

            # Fading intensity
            intensity = 1 - progress

            # Cyan shield color
            arr[ring_mask, 0] = 100
            arr[ring_mask, 1] = int(255 * intensity)
            arr[ring_mask, 2] = int(255 * intensity)
            arr[ring_mask, 3] = int(200 * intensity)

            frame = Image.fromarray(arr)
            sheet.paste(frame, (i * size, 0))

        sheet_path = EFFECTS_DIR / f"shield_hit_{size}.png"
        sheet.save(sheet_path, format='PNG')

        meta = {
            'effect': 'shield_hit',
            'size': size,
            'frames': frames,
            'frame_width': size,
            'frame_height': size,
            'loop': False
        }
        meta_path = EFFECTS_DIR / f"shield_hit_{size}.json"
        with open(meta_path, 'w') as f:
            json.dump(meta, f, indent=2)

        print("OK")


def generate_all_effects():
    """Generate all effect spritesheets"""
    generate_explosion_sheet()
    generate_thruster_sheet()
    generate_shield_hit_sheet()
    print(f"\nEffects output: {EFFECTS_DIR}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Shattered Stars - Game Sprite Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create_game_sprites.py --pixelate              # Convert to pixel art
  python create_game_sprites.py --spritesheets          # Generate animations
  python create_game_sprites.py --atlas                 # Build texture atlases
  python create_game_sprites.py --effects               # Generate effect sheets
  python create_game_sprites.py --all                   # Full pipeline
        """
    )

    # Actions
    parser.add_argument("--pixelate", action="store_true",
                       help="Convert high-res sprites to pixel art")
    parser.add_argument("--spritesheets", action="store_true",
                       help="Generate animation spritesheets")
    parser.add_argument("--rotations", action="store_true",
                       help="Generate rotation spritesheets (16 directions)")
    parser.add_argument("--explosions", action="store_true",
                       help="Generate ship-specific explosion sequences")
    parser.add_argument("--atlas", action="store_true",
                       help="Build texture atlases for batch rendering")
    parser.add_argument("--effects", action="store_true",
                       help="Generate effect spritesheets (explosions, thrusters)")
    parser.add_argument("--all", action="store_true",
                       help="Run full pipeline")

    # Options
    parser.add_argument("--faction", type=str,
                       help="Process only specific faction")
    parser.add_argument("--force", action="store_true",
                       help="Overwrite existing files")
    parser.add_argument("--reduce-colors", action="store_true",
                       help="Reduce color palette for retro look")
    parser.add_argument("--no-pixel", action="store_true",
                       help="Use original high-res sprites for spritesheets")
    parser.add_argument("--directions", type=int, default=16,
                       help="Number of rotation directions (default: 16)")

    args = parser.parse_args()

    factions = [args.faction] if args.faction else None

    if args.all:
        pixelate_all_sprites(factions, args.force, args.reduce_colors)
        generate_all_spritesheets(factions, use_pixel=True, force=args.force)
        generate_all_rotations(factions, use_pixel=True, force=args.force, num_directions=args.directions)
        generate_ship_explosion_sheets(factions, use_pixel=True, force=args.force)
        build_texture_atlas(factions, use_pixel=True)
        generate_all_effects()
        return

    if args.pixelate:
        pixelate_all_sprites(factions, args.force, args.reduce_colors)

    if args.spritesheets:
        generate_all_spritesheets(factions, use_pixel=not args.no_pixel, force=args.force)

    if args.rotations:
        generate_all_rotations(factions, use_pixel=not args.no_pixel, force=args.force,
                               num_directions=args.directions)

    if args.explosions:
        generate_ship_explosion_sheets(factions, use_pixel=not args.no_pixel, force=args.force)

    if args.atlas:
        build_texture_atlas(factions, use_pixel=not args.no_pixel)

    if args.effects:
        generate_all_effects()

    if not any([args.pixelate, args.spritesheets, args.rotations, args.explosions,
                args.atlas, args.effects, args.all]):
        parser.print_help()


if __name__ == "__main__":
    main()
