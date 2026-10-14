"""Procedural silhouette guides (ControlNet depth input) for generate_creature_art_comfy.py.

SDXL ignores "top-down" for creature prompts, so each sprite is drawn as a soft white shape on black
(head / front UP, centred, left/right mirrored) and fed to the union ControlNet. All shapes are
described on the LEFT half of a 1024 canvas; finish() mirrors them and adds soft volume.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
CENTRE = SIZE // 2
EDGE_BLUR_PX = 6
VOLUME_BLUR_PX = 38
VOLUME_WEIGHT = 0.5
WHITE = 255
RECESS_LEVEL = 110  # a recessed disc (maw) reads darker than the surrounding rim


def _blank() -> tuple:
    image = Image.new("L", (SIZE, SIZE), 0)
    return image, ImageDraw.Draw(image)


def _finish(image: Image.Image) -> Image.Image:
    """Mirror the left half onto the right, then add soft volume so the centre reads as nearer."""
    left = image.crop((0, 0, CENTRE, SIZE))
    image.paste(left.transpose(Image.FLIP_LEFT_RIGHT), (CENTRE, 0))
    mask = np.array(image.filter(ImageFilter.GaussianBlur(EDGE_BLUR_PX)), dtype=float) / 255.0
    volume = np.array(image.filter(ImageFilter.GaussianBlur(VOLUME_BLUR_PX)), dtype=float) / 255.0
    depth = mask * (1.0 - VOLUME_WEIGHT) + mask * volume * VOLUME_WEIGHT
    return Image.fromarray((np.clip(depth, 0, 1) * 255).astype(np.uint8)).convert("RGB")


def _ellipse(draw: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float) -> None:
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=WHITE)


def _limb(draw: ImageDraw.ImageDraw, points: list, start_width: float, end_width: float) -> None:
    """Draw a tapered limb through points (list of (x, y)) as overlapping discs."""
    steps = 24
    for index in range(len(points) - 1):
        (x0, y0), (x1, y1) = points[index], points[index + 1]
        for step in range(steps):
            t = (index + step / steps) / (len(points) - 1)
            x, y = x0 + (x1 - x0) * step / steps, y0 + (y1 - y0) * step / steps
            radius = (start_width + (end_width - start_width) * t) / 2
            _ellipse(draw, x, y, radius, radius)


def cinder_wyrm_body() -> Image.Image:
    image, draw = _blank()
    draw.polygon([(CENTRE, 100), (440, 250), (390, 420), (360, 560), (420, 740), (CENTRE, 790)], fill=WHITE)
    _limb(draw, [(380, 470), (290, 620), (230, 840)], 56, 10)
    _limb(draw, [(395, 600), (260, 650), (150, 720)], 40, 8)
    return _finish(image)


def segment_plate(spikes: bool = True) -> Image.Image:
    """Wide oval armour band (serpent / worm body segment) with two side spikes."""
    image, draw = _blank()
    _ellipse(draw, CENTRE, CENTRE, 360, 250)
    if spikes:
        draw.polygon([(180, 470), (60, 512), (180, 560)], fill=WHITE)
    return _finish(image)


def deepmaw_body() -> Image.Image:
    image, draw = _blank()
    _ellipse(draw, CENTRE, 480, 240, 380)
    draw.ellipse((CENTRE - 125, 130, CENTRE + 125, 380), fill=RECESS_LEVEL)
    for tips in ([(330, 600), (200, 560), (110, 380)], [(310, 720), (170, 800), (110, 940)],
                 [(340, 480), (200, 420), (230, 250)]):
        _limb(draw, tips, 70, 16)
    return _finish(image)


def choir_hive_body() -> Image.Image:
    image, draw = _blank()
    _ellipse(draw, CENTRE, CENTRE, 105, 105)
    for index in range(8):
        angle = math.radians(index * 45 + 22.5)
        direction = (math.cos(angle), -math.sin(angle))
        _limb(draw, [(CENTRE + 140 * direction[0], CENTRE + 140 * direction[1]),
                     (CENTRE + 300 * direction[0], CENTRE + 300 * direction[1])], 70, 120)
    for index in range(4):
        angle = math.radians(index * 90)
        _ellipse(draw, CENTRE + 410 * math.cos(angle), CENTRE - 410 * math.sin(angle), 85, 85)
    return _finish(image)


def choir_hive_pod() -> Image.Image:
    image, draw = _blank()
    _ellipse(draw, CENTRE, CENTRE, 230, 230)
    for index in range(10):
        angle = math.radians(index * 36 + 18)
        tip = (CENTRE + 460 * math.cos(angle), CENTRE - 460 * math.sin(angle))
        base_a = (CENTRE + 200 * math.cos(angle + 0.2), CENTRE - 200 * math.sin(angle + 0.2))
        base_b = (CENTRE + 200 * math.cos(angle - 0.2), CENTRE - 200 * math.sin(angle - 0.2))
        draw.polygon([base_a, tip, base_b], fill=WHITE)
    return _finish(image)


def pruning_herald_body() -> Image.Image:
    image, draw = _blank()
    draw.polygon([(CENTRE, 540), (330, 480), (150, 80), (420, 380)], fill=WHITE)
    draw.polygon([(CENTRE, 540), (300, 560), (110, 220), (380, 450)], fill=WHITE)
    _ellipse(draw, CENTRE, 560, 130, 150)
    draw.polygon([(430, 640), (330, 960), (CENTRE, 700)], fill=WHITE)
    return _finish(image)


def warden_avatar_body() -> Image.Image:
    image, draw = _blank()
    for angle in (90, 180, 270, 0):
        rad = math.radians(angle)
        _ellipse(draw, CENTRE + 210 * math.cos(rad), CENTRE - 210 * math.sin(rad),
                 *((120, 230) if angle in (90, 270) else (230, 120)))
    _ellipse(draw, CENTRE, CENTRE, 150, 150)
    return _finish(image)


def tidecell_body() -> Image.Image:
    image, draw = _blank()
    _ellipse(draw, CENTRE, 560, 250, 300)
    draw.polygon([(CENTRE, 100), (350, 400), (674, 400)], fill=WHITE)
    _limb(draw, [(CENTRE, 800), (470, 900), (500, 990)], 40, 6)
    return _finish(image)


def hulk_gnawer_body() -> Image.Image:
    image, draw = _blank()
    draw.polygon([(CENTRE, 330), (390, 340), (350, 560), (410, 860), (CENTRE, 900)], fill=WHITE)
    _ellipse(draw, CENTRE, 250, 135, 160)
    _limb(draw, [(430, 130), (470, 60), (500, 30)], 60, 20)
    return _finish(image)


def hulk_gnawer_segment() -> Image.Image:
    image, draw = _blank()
    _ellipse(draw, CENTRE, CENTRE, 340, 240)
    _limb(draw, [(250, 560), (150, 640), (120, 740)], 50, 18)
    _limb(draw, [(250, 460), (150, 380), (120, 290)], 50, 18)
    return _finish(image)


GUIDES: dict = {
    "cinder_wyrm_body": cinder_wyrm_body,
    "cinder_wyrm_segment": segment_plate,
    "deepmaw_body": deepmaw_body,
    "choir_hive_body": choir_hive_body,
    "choir_hive_pod": choir_hive_pod,
    "pruning_herald_body": pruning_herald_body,
    "warden_avatar_body": warden_avatar_body,
    "tidecell_body": tidecell_body,
    "hulk_gnawer_body": hulk_gnawer_body,
    "hulk_gnawer_segment": hulk_gnawer_segment,
}
