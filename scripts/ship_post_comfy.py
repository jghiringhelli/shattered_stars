"""Post-processing and automatic QC of generated ship art: key, lift, faction tint, outline, checks.

Pure image functions (no node access).
"""
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import binary_dilation, label

from ship_guides_comfy import footprint

SPRITE_OUT_PX = 512
SPRITE_FILL_PX = 470  # longest bbox side after keying (margin for the outline)
FOOTPRINT_THRESHOLD = 40  # guide level that counts as ship (the blurred guide edge is ~5 px)
TARGET_MEAN_LUMINANCE = 0.40  # sprites are lifted to this mean so hulls read on a dark starfield
MIN_GAMMA = 0.45
TINT_STRENGTH = 0.30
TINT_BOOST = 1.6
OUTLINE_PX = 2
OUTLINE_OPACITY = 0.55
LUMA = np.array([0.299, 0.587, 0.114])

FACTION_TINT = {
    "terran_hegemony": (70, 120, 235), "free_confederation": (245, 140, 40),
    "synthetic_collective": (60, 200, 255), "void_corsairs": (210, 45, 80),
    "ascendant_empire": (50, 225, 150),
}

SPRITE_MIN_COVERAGE, SPRITE_MAX_COVERAGE = 0.05, 0.6
SPRITE_MAX_OFFCENTRE_PX = 12  # bounding-box centre vs canvas centre (key_sprite centres the bbox)
SPRITE_MAIN_SHAPE_SHARE = 0.9
SPRITE_CLUSTER_DILATION = 45  # floating segments of one ship (Collective) still count as one shape
SPRITE_MIN_MEAN_LUMINANCE, SPRITE_MIN_DETAIL = 0.22, 0.05
ILLUSTRATION_LUMINANCE_RANGE = (0.07, 0.5)
ILLUSTRATION_MIN_DETAIL = 0.07
ILLUSTRATION_MAX_BLOWN_SHARE = 0.05


def lift_hull(image: Image.Image) -> Image.Image:
    """Gamma-lift an RGBA sprite so its opaque pixels average TARGET_MEAN_LUMINANCE (never darkens)."""
    pixels = np.array(image, dtype=float) / 255.0
    opaque = pixels[:, :, 3] > 0.5
    if not opaque.any():
        return image
    mean = float((pixels[:, :, :3][opaque] @ LUMA).mean())
    gamma = float(np.clip(np.log(TARGET_MEAN_LUMINANCE) / np.log(max(mean, 1e-3)), MIN_GAMMA, 1.0))
    pixels[:, :, :3] = pixels[:, :, :3] ** gamma
    return Image.fromarray((pixels * 255).astype(np.uint8), mode="RGBA")


def tint_toward(image: Image.Image, colour: tuple) -> Image.Image:
    """Blend the hull toward a faction colour while keeping its luminance structure."""
    pixels = np.array(image, dtype=float) / 255.0
    luminance = (pixels[:, :, :3] @ LUMA)[:, :, None]
    tinted = np.clip(luminance * (np.array(colour) / 255.0) * TINT_BOOST, 0, 1)
    pixels[:, :, :3] = pixels[:, :, :3] * (1 - TINT_STRENGTH) + tinted * TINT_STRENGTH
    return Image.fromarray((pixels * 255).astype(np.uint8), mode="RGBA")


def add_outline(image: Image.Image, colour: tuple) -> Image.Image:
    """Put a faint faction-coloured rim behind the sprite so it separates from busy backgrounds."""
    alpha = image.getchannel("A")
    rim = alpha.filter(ImageFilter.MaxFilter(OUTLINE_PX * 2 + 1)).filter(ImageFilter.GaussianBlur(1))
    rim = rim.point(lambda v: int(v * OUTLINE_OPACITY))
    layer = Image.new("RGBA", image.size, colour + (0,))
    layer.putalpha(rim)
    return Image.alpha_composite(layer, image)


def key_sprite(raw: Image.Image, guide: Image.Image, faction: str) -> Image.Image:
    """Key a raw top-down render with its guide, fit to a centred 512x512 RGBA, lift, tint and outline.

    The alpha is the guide silhouette (not a luminance key: dark hulls on a black backdrop must survive,
    and anything SDXL drew outside the silhouette is erased).
    """
    image = raw.convert("RGBA")
    image.putalpha(footprint(guide, FOOTPRINT_THRESHOLD))
    image = tint_toward(lift_hull(image), FACTION_TINT[faction])
    canvas = Image.new("RGBA", (SPRITE_OUT_PX, SPRITE_OUT_PX), (0, 0, 0, 0))
    box = image.getbbox()
    if box:
        ship = image.crop(box)
        scale = SPRITE_FILL_PX / max(ship.size)
        ship = ship.resize((max(1, round(ship.width * scale)), max(1, round(ship.height * scale))), Image.LANCZOS)
        canvas.paste(ship, ((SPRITE_OUT_PX - ship.width) // 2, (SPRITE_OUT_PX - ship.height) // 2), ship)
    return add_outline(canvas, FACTION_TINT[faction])


def qc_sprite(sprite: Image.Image) -> tuple:
    """Automatic sprite checks: coverage, centred, one main shape, hull brightness and detail.

    :returns: (passed, score, reason); the score ranks candidates (higher is better).
    """
    pixels = np.array(sprite.convert("RGBA"), dtype=float) / 255.0
    solid = pixels[:, :, 3] > 0.5
    if not solid.any():
        return False, 0.0, "empty"
    coverage = float(solid.mean())
    ys, xs = np.nonzero(solid)
    offset = max(abs((xs.min() + xs.max()) / 2 - SPRITE_OUT_PX / 2), abs((ys.min() + ys.max()) / 2 - SPRITE_OUT_PX / 2))
    clusters, count = label(binary_dilation(solid, iterations=SPRITE_CLUSTER_DILATION))
    main_share = float(np.bincount(clusters[solid])[1:].max() / solid.sum()) if count else 0.0
    luminance = pixels[:, :, :3][solid] @ LUMA
    mean, detail = float(luminance.mean()), float(luminance.std())
    reason = ""
    if not SPRITE_MIN_COVERAGE <= coverage <= SPRITE_MAX_COVERAGE:
        reason = "coverage"
    elif offset > SPRITE_MAX_OFFCENTRE_PX:
        reason = "off-centre"
    elif main_share < SPRITE_MAIN_SHAPE_SHARE:
        reason = "fragmented"
    elif mean < SPRITE_MIN_MEAN_LUMINANCE or detail < SPRITE_MIN_DETAIL:
        reason = "flat or dark"
    return not reason, detail + 0.5 * min(mean, 0.5) + main_share, reason


def qc_illustration(image: Image.Image) -> tuple:
    """Automatic illustration checks: not too dark, not blown out, enough detail.

    :returns: (passed, score, reason).
    """
    luminance = np.array(image.convert("RGB"), dtype=float) / 255.0 @ LUMA
    mean, detail = float(luminance.mean()), float(luminance.std())
    blown = float((luminance > 0.92).mean())
    reason = ""
    if not ILLUSTRATION_LUMINANCE_RANGE[0] <= mean <= ILLUSTRATION_LUMINANCE_RANGE[1]:
        reason = "exposure"
    elif detail < ILLUSTRATION_MIN_DETAIL:
        reason = "flat"
    elif blown > ILLUSTRATION_MAX_BLOWN_SHARE:
        reason = "blown out"
    return not reason, detail - blown, reason


def starfield(size: tuple, seed: int) -> Image.Image:
    """Dark blue-black starfield (RGB) used as the img2img backdrop of an illustration."""
    rng = random.Random(seed)
    image = Image.new("RGB", size, (6, 8, 20))
    draw = ImageDraw.Draw(image)
    for _ in range(size[0] * size[1] // 2500):
        level = rng.randint(120, 255)
        draw.point((rng.randrange(size[0]), rng.randrange(size[1])), fill=(level, level, min(255, level + 20)))
    return image.filter(ImageFilter.GaussianBlur(0.5))

