"""Procedural silhouette guides (ControlNet depth input) for ship art: role x faction x per-ship jitter.

SDXL ignores "top-down", "needle thin" and "asymmetric" in prompts, so every ship is drawn as a soft white
shape on black (nose UP, centred; left half drawn, mirrored, then faction asymmetry added) and fed to the
union ControlNet. Pure functions of (ship_id, faction, role): the whole roster is automated.
"""
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
CX = SIZE // 2
WHITE = 255
EDGE_BLUR_PX = 5
EDGE_FEATHER_PX = 0.8
VOLUME_BLUR_PX = 34
VOLUME_WEIGHT = 0.55
ILLUSTRATION_RENDER_PX = (1200, 800)
ILLUSTRATION_TURN_DEGREES = 58
ILLUSTRATION_SQUASH = 0.62
ILLUSTRATION_FILL_PX = 1050

# length / half body width / half span (fractions of SIZE), wing root front/back (fraction of length)
ROLE_PARAMS = {
    "light_fighter": dict(length=0.52, hw=0.075, span=0.21, wing=(0.45, 0.88)),
    "interceptor": dict(length=0.78, hw=0.045, span=0.19, wing=(0.55, 0.92)),
    "heavy_fighter": dict(length=0.60, hw=0.105, span=0.28, wing=(0.38, 0.88)),
    "bomber": dict(length=0.66, hw=0.13, span=0.23, wing=(0.35, 0.82)),
    "gunship": dict(length=0.64, hw=0.12, span=0.27, wing=(0.32, 0.82)),
    "support": dict(length=0.56, hw=0.11, span=0.25, wing=(0.40, 0.80)),
    "capital": dict(length=0.90, hw=0.085, span=0.20, wing=(0.30, 0.90)),
}
FACTION_WING_STYLE = {
    "terran_hegemony": "angular", "free_confederation": "boxy", "synthetic_collective": "diamond",
    "void_corsairs": "spiky", "ascendant_empire": "crescent",
}
CAPITAL_VARIANTS = {
    "terran_hegemony": ("spine", "slab"), "free_confederation": ("slab", "twin"),
    "synthetic_collective": ("ring", "trident"), "void_corsairs": ("twin", "spine"),
    "ascendant_empire": ("trident", "ring", "spine"),
}
HEAVY_ROLES = ("heavy_fighter", "bomber", "gunship")


def _ellipse(draw: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, fill: int = WHITE) -> None:
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=fill)


def _box(draw: ImageDraw.ImageDraw, x0: float, y0: float, x1: float, y1: float, fill: int) -> None:
    draw.rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), fill=fill)


def _limb(draw: ImageDraw.ImageDraw, points: list, start_width: float, end_width: float) -> None:
    """Draw a tapered limb through points as overlapping discs."""
    steps = 28
    for index in range(len(points) - 1):
        (x0, y0), (x1, y1) = points[index], points[index + 1]
        for step in range(steps):
            t = (index + step / steps) / (len(points) - 1)
            radius = (start_width + (end_width - start_width) * t) / 2
            _ellipse(draw, x0 + (x1 - x0) * step / steps, y0 + (y1 - y0) * step / steps, radius, radius)


def _body(draw: ImageDraw.ImageDraw, role: str, style: str, top: float, height: float, hw: float) -> None:
    if style == "diamond":
        pts = [(CX, top), (CX - hw, top + height * 0.38), (CX - hw * 0.8, top + height * 0.72), (CX, top + height)]
    elif role == "capital":
        pts = [(CX, top), (CX - hw * 0.6, top + height * 0.08), (CX - hw, top + height * 0.2),
               (CX - hw, top + height * 0.9), (CX - hw * 0.7, top + height), (CX, top + height)]
    else:
        pts = [(CX, top), (CX - hw * 0.55, top + height * 0.22), (CX - hw, top + height * 0.45),
               (CX - hw * 0.9, top + height * 0.85), (CX - hw * 0.6, top + height), (CX, top + height)]
    draw.polygon(pts, fill=WHITE)


def _angular_wing(draw: ImageDraw.ImageDraw, role: str, spec: dict, y_a: float, y_b: float, rng: random.Random) -> None:
    top, height, hw, span = spec["top"], spec["height"], spec["hw"], spec["span"]
    if role == "interceptor":  # forward-swept spars: the opposite of a jet's swept-back delta
        draw.polygon([(CX - hw * 0.9, y_b), (CX - span, top + height * 0.22),
                      (CX - span + hw * 0.7, top + height * 0.2), (CX - hw * 0.9, y_b - height * 0.14)], fill=WHITE)
    elif role in HEAVY_ROLES:  # chamfered armoured side pods
        draw.polygon([(CX - hw * 0.9, y_a), (CX - span * 0.85, y_a), (CX - span, y_a + height * 0.08),
                      (CX - span, y_b - height * 0.1), (CX - span * 0.85, y_b), (CX - hw * 0.9, y_b)], fill=WHITE)
    else:
        sweep = rng.uniform(0.18, 0.32)
        draw.polygon([(CX - hw * 0.9, y_a), (CX - span, y_a + height * sweep),
                      (CX - span, y_a + height * (sweep + 0.12)), (CX - hw * 0.9, y_b)], fill=WHITE)


def _wing(draw: ImageDraw.ImageDraw, style: str, role: str, spec: dict, rng: random.Random) -> None:
    top, height, hw, span = spec["top"], spec["height"], spec["hw"], spec["span"]
    y_a, y_b = top + height * spec["wing"][0], top + height * spec["wing"][1]
    mid = (y_a + y_b) / 2
    if style == "angular":
        _angular_wing(draw, role, spec, y_a, y_b, rng)
    elif style == "boxy":
        draw.polygon([(CX - hw * 0.9, y_a), (CX - span, y_a + height * 0.05),
                      (CX - span, y_b - height * 0.05), (CX - hw * 0.9, y_b)], fill=WHITE)
        _ellipse(draw, CX - span, mid, hw * 0.55, height * rng.uniform(0.14, 0.22))
    elif style == "diamond":
        reach = (span - hw) * 0.5
        gap_x = CX - (hw + span) / 2 - hw * 0.4
        draw.polygon([(gap_x, mid - reach * 1.5), (gap_x - reach, mid), (gap_x, mid + reach * 1.5),
                      (gap_x + reach, mid)], fill=WHITE)
        draw.polygon([(CX - span, y_b), (CX - span - reach * 0.3, y_b + reach), (CX - span + reach * 0.3, y_b + reach)],
                     fill=WHITE)
    elif style == "spiky":
        draw.polygon([(CX - hw * 0.9, y_a), (CX - span, top + height * rng.uniform(0.02, 0.18)),
                      (CX - span * 0.72, y_a + height * 0.1), (CX - hw, y_b)], fill=WHITE)
        draw.polygon([(CX - hw, y_b - height * 0.1), (CX - span * 0.8, y_b + height * 0.06),
                      (CX - hw, y_b + height * 0.02)], fill=WHITE)
    else:
        _limb(draw, [(CX - hw, y_b), (CX - span * 0.72, y_a + (y_b - y_a) * 0.3), (CX - span, top + height * 0.2)],
              hw * 1.5, 7)


def _role_extras(draw: ImageDraw.ImageDraw, role: str, spec: dict, rng: random.Random) -> None:
    top, height, hw = spec["top"], spec["height"], spec["hw"]
    _ellipse(draw, CX - hw * 0.55, top + height * 0.98, hw * 0.34, height * 0.07)
    if role == "bomber":
        for offset in (0.4, 0.6):
            _ellipse(draw, CX - hw * 1.35, top + height * offset, hw * 0.28, height * 0.1)
    elif role == "gunship":
        for offset in (0.3, 0.52):
            _ellipse(draw, CX - hw * 0.45, top + height * offset, hw * 0.4, hw * 0.4)
    elif role == "support":
        _ellipse(draw, CX, top + height * 0.32, hw * 1.15, hw * 1.15)


def _capital_batteries(draw: ImageDraw.ImageDraw, spec: dict, rng: random.Random) -> None:
    top, height, hw = spec["top"], spec["height"], spec["hw"]
    for index in range(4):
        y = top + height * (0.22 + index * 0.17)
        _box(draw, CX - hw * rng.uniform(1.8, 2.5), y, CX - hw * 0.8, y + height * 0.12, WHITE)


def _capital(draw: ImageDraw.ImageDraw, variant: str, spec: dict, rng: random.Random) -> None:
    """Draw the left half (or a centred shape) of a capital ship; the caller mirrors it."""
    top, height, hw, span = spec["top"], spec["height"], spec["hw"], spec["span"]
    bottom = top + height
    if variant == "slab":
        w = span * 0.95
        draw.polygon([(CX, top), (CX - w * 0.5, top + height * 0.06), (CX - w, top + height * 0.2),
                      (CX - w, top + height * 0.95), (CX - w * 0.6, bottom), (CX, bottom)], fill=WHITE)
        for offset in (0.3, 0.5, 0.7):
            _box(draw, CX - w, top + height * offset, CX - w * 0.74, top + height * (offset + 0.08), 0)
    elif variant == "twin":
        hx, half = CX - span * 0.8, hw * 0.8
        draw.polygon([(hx, top), (hx - half, top + height * 0.15), (hx - half, bottom),
                      (hx + half, bottom), (hx + half, top + height * 0.15)], fill=WHITE)
        _box(draw, hx, top + height * 0.42, CX, top + height * 0.52, WHITE)
        _box(draw, CX - hw * 0.4, top + height * 0.1, CX, bottom - height * 0.05, WHITE)
    elif variant == "ring":
        _ellipse(draw, CX, top + height * 0.45, span * 1.05, span * 1.05)
        _ellipse(draw, CX, top + height * 0.45, span * 1.05 - hw * 0.55, span * 1.05 - hw * 0.55, 0)
        draw.polygon([(CX, top), (CX - hw * 0.7, top + height * 0.12), (CX - hw * 0.7, bottom), (CX, bottom)], fill=WHITE)
    elif variant == "trident":
        draw.polygon([(CX, top), (CX - hw * 0.8, top + height * 0.2), (CX - hw * 0.8, bottom), (CX, bottom)], fill=WHITE)
        _limb(draw, [(CX - span, top + height * 0.1), (CX - span * 0.85, top + height * 0.5)], hw * 1.1, hw * 1.1)
        _box(draw, CX - span * 1.05, top + height * 0.5, CX, top + height * 0.85, WHITE)
    else:
        _body(draw, "capital", "angular", top, height, hw)
        _angular_wing(draw, "capital", spec, top + height * spec["wing"][0], top + height * spec["wing"][1], rng)
        _capital_batteries(draw, spec, rng)
    _ellipse(draw, CX - hw * 0.55, bottom - height * 0.02, hw * 0.34, height * 0.07)


def _asymmetry(draw: ImageDraw.ImageDraw, faction: str, spec: dict, rng: random.Random) -> None:
    """Break the mirror symmetry after mirroring (salvaged modules, scavenged blades)."""
    top, height, hw, span = spec["top"], spec["height"], spec["hw"], spec["span"]
    side = rng.choice((-1, 1))
    if faction == "free_confederation":
        y = top + height * rng.uniform(0.35, 0.6)
        _box(draw, CX + side * hw * 0.8, y, CX + side * (hw + span * 0.6), y + height * 0.14, WHITE)
    elif faction == "void_corsairs":
        _limb(draw, [(CX + side * hw, top + height * 0.4), (CX + side * span * 0.6, top + height * 0.12)], hw * 0.6, 6)
        _box(draw, CX + side * span * 0.8, top + height * 0.5, CX + side * span * 1.1, top + height * 0.9, 0)


def finish(image: Image.Image) -> Image.Image:
    """Soften a hard white-on-black mask into a depth-like guide (RGB)."""
    mask = np.array(image.filter(ImageFilter.GaussianBlur(EDGE_BLUR_PX)), dtype=float) / 255.0
    volume = np.array(image.filter(ImageFilter.GaussianBlur(VOLUME_BLUR_PX)), dtype=float) / 255.0
    depth = mask * (1.0 - VOLUME_WEIGHT) + mask * volume * VOLUME_WEIGHT
    return Image.fromarray((np.clip(depth, 0, 1) * 255).astype(np.uint8)).convert("RGB")


def sprite_guide(ship_id: str, faction: str, role: str) -> Image.Image:
    """Top-down depth guide (1024x1024 RGB, nose up) of a ship.

    :param ship_id: ship id; seeds the per-ship proportion jitter and capital variant.
    :param faction: faction id (selects the wing style, asymmetry and capital variants).
    :param role: ship role (selects proportions and extras).
    :returns: the guide image.
    """
    rng = random.Random(ship_id)
    params = ROLE_PARAMS[role]
    height = SIZE * params["length"] * rng.uniform(0.94, 1.06)
    spec = {"top": (SIZE - height) / 2, "height": height, "hw": SIZE * params["hw"] * rng.uniform(0.9, 1.15),
            "span": SIZE * params["span"] * rng.uniform(0.9, 1.15), "wing": params["wing"]}
    style = FACTION_WING_STYLE[faction]
    image = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(image)
    if role == "capital":
        _capital(draw, rng.choice(CAPITAL_VARIANTS[faction]), spec, rng)
    else:
        _body(draw, role, style, spec["top"], spec["height"], spec["hw"])
        _wing(draw, style, role, spec, rng)
        _role_extras(draw, role, spec, rng)
    left = image.crop((0, 0, CX, SIZE))
    image.paste(left.transpose(Image.FLIP_LEFT_RIGHT), (CX, 0))
    _asymmetry(draw, faction, spec, rng)
    return finish(image)


def footprint(guide: Image.Image, threshold: int) -> Image.Image:
    """Silhouette mask (mode L) of a guide: pixels above the threshold, softened by a little blur."""
    mask = guide.convert("L").point(lambda v: 255 if v > threshold else 0)
    return mask.filter(ImageFilter.GaussianBlur(EDGE_FEATHER_PX))


def three_quarter(sprite: Image.Image) -> Image.Image:
    """Turn a plan-view RGBA sprite into a faux three-quarter view (rotate, squash, centre) on a 3:2 RGBA canvas."""
    turned = sprite.convert("RGBA").rotate(-ILLUSTRATION_TURN_DEGREES, expand=True, resample=Image.BICUBIC)
    turned = turned.crop(turned.getbbox())
    scale = ILLUSTRATION_FILL_PX / max(turned.size)
    squashed = turned.resize((round(turned.width * scale), round(turned.height * scale * ILLUSTRATION_SQUASH)),
                             Image.LANCZOS)
    canvas = Image.new("RGBA", ILLUSTRATION_RENDER_PX, (0, 0, 0, 0))
    canvas.paste(squashed, ((canvas.width - squashed.width) // 2, (canvas.height - squashed.height) // 2))
    return canvas


def illustration_guide(warped: Image.Image) -> Image.Image:
    """Depth guide (RGB) of a three_quarter() sprite: its blurred alpha silhouette."""
    return finish(warped.getchannel("A"))

