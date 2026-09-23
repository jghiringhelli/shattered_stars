#!/usr/bin/env python3
"""
Give ship art a real alpha channel by keying out its background.

The art was generated on a near-black backdrop with no alpha, so the renderer
faked transparency with an ADD blend. ADD adds every pixel to whatever is
behind it: bright ships blow out into glowing blobs, nothing ever occludes
anything, and a ship over a bright nebula washes away entirely.

A luminance threshold alone would eat the dark panels of the hull, so the
background is found by flood-filling inward from the border: only dark pixels
connected to the edge are background. Dark detail enclosed by the ship keeps
its alpha.

Usage:
    python scripts/key_ship_alpha.py [--dry-run] [--only <path>]
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import binary_dilation, label

SHIP_GLOB = "public/assets/ships/*/*.png"

# Pixels at or below this luminance can be background. Generous, because the
# flood fill is what actually decides; this only limits where it may spread.
BACKGROUND_LUMINANCE = 42

# Grow the keyed region back by this much to bite off the dark halo that
# surrounds the subject in diffusion output.
HALO_BITE_PIXELS = 1

# Blur radius applied to the mask so edges are not stair-stepped.
EDGE_FEATHER = 0.6


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """
    Locate the background of one image.

    :param rgb: HxWx3 uint8 pixel data.
    :returns: HxW bool array, True where the pixel is background.
    """
    luminance = rgb @ np.array([0.299, 0.587, 0.114])
    dark = luminance <= BACKGROUND_LUMINANCE

    labels, count = label(dark)
    if count == 0:
        return np.zeros(dark.shape, dtype=bool)

    border = np.concatenate([
        labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1],
    ])
    border_labels = set(int(v) for v in np.unique(border) if v != 0)
    if not border_labels:
        return np.zeros(dark.shape, dtype=bool)

    mask = np.isin(labels, list(border_labels))
    if HALO_BITE_PIXELS > 0:
        mask = binary_dilation(mask, iterations=HALO_BITE_PIXELS)
    return mask


def key_image(path: Path) -> bool:
    """
    Rewrite one ship image with a keyed alpha channel.

    Always writes RGBA, even when nothing could be keyed, so the whole roster
    has one pixel format. Art that fills its frame edge to edge simply ends up
    fully opaque rather than being left in a second, older format.

    :param path: Image to process, modified in place.
    :returns: True when a background was found and made transparent.
    """
    image = Image.open(path).convert("RGBA")
    rgb = np.array(image)[:, :, :3]

    mask = background_mask(rgb)
    if mask.any():
        alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), mode="L")
        alpha = alpha.filter(ImageFilter.GaussianBlur(EDGE_FEATHER))
        image.putalpha(alpha)

    image.save(path)
    return bool(mask.any())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", help="process a single file instead of all")
    args = parser.parse_args()

    targets = [Path(args.only)] if args.only else sorted(Path().glob(SHIP_GLOB))
    print(f"{len(targets)} image(s)")

    changed = 0
    for path in targets:
        if args.dry_run:
            rgb = np.array(Image.open(path).convert("RGBA"))[:, :, :3]
            share = background_mask(rgb).mean()
            print(f"  {path.name}: {share:.1%} background")
            continue
        if key_image(path):
            changed += 1

    if not args.dry_run:
        print(f"{changed} image(s) keyed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
