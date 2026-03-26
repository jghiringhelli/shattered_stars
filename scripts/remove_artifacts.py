#!/usr/bin/env python3
"""
remove_artifacts.py — Remove decorative frame/background artifacts from ship sprites.

Two modes:
  purple-disk   Zero dark purplish background pixels (for corsair ring-pattern ships).
                Targets: B > R AND B > G AND brightness < 140
                Safe to use on: corsair_fang, corsair_wraith, corsair_havoc

  rect-frame    Zero all pixels outside a circular inscribed region (radius = 46% of width).
                Then zero corner bracket pixels (high brightness outside that radius).
                Safe to use on: corsair_dart, synth_guardian

Usage:
  python remove_artifacts.py purple-disk  INPUT.png [OUTPUT.png]
  python remove_artifacts.py rect-frame   INPUT.png [OUTPUT.png]
  python remove_artifacts.py preview      INPUT.png           # read-only pixel analysis

Pixels zeroed → shown as black → ADD blend mode makes them transparent in Phaser.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def load(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"), dtype=np.uint8)


def save(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(arr).save(path)
    print(f"Saved {path}")


def remove_purple_disk(arr: np.ndarray) -> tuple[np.ndarray, int]:
    """Zero dark-purple background pixels: B dominant, overall dim."""
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    brightness = (r + g + b) // 3
    # Purple background: blue channel leads, overall dim, NOT the vivid blue of cockpits/engines.
    # Dark purple bg: B≈65-95, brightness≈46.  Vivid blue cockpit: B≈150-200, brightness≈75.
    # Threshold B < 120 keeps ship details while zeroing dull purple fills.
    mask = (b > r + 10) & (b > g + 10) & (brightness < 130) & (b < 120)
    result = arr.copy()
    result[mask] = [0, 0, 0]
    return result, int(mask.sum())


def remove_rect_frame(arr: np.ndarray) -> tuple[np.ndarray, int]:
    """Zero pixels outside an inscribed circle (removes corner brackets and border)."""
    h, w = arr.shape[:2]
    cy, cx = h / 2, w / 2
    # Radius covers 46% of image width — keeps ship body, removes corner brackets
    max_radius = w * 0.46
    ys, xs = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    mask = dist > max_radius
    result = arr.copy()
    result[mask] = [0, 0, 0]
    return result, int(mask.sum())


def preview(arr: np.ndarray) -> None:
    """Print pixel color distribution hints."""
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    brightness = (r + g + b) // 3

    purple = (b > r + 10) & (b > g + 10) & (brightness < 130)
    gold   = (r > 180) & (g > 120) & (b < 100)
    dark   = brightness < 20

    total = arr.shape[0] * arr.shape[1]
    print(f"Total pixels : {total}")
    print(f"Purple-bg    : {purple.sum()} ({100*purple.sum()/total:.1f}%)")
    print(f"Gold bright  : {gold.sum()} ({100*gold.sum()/total:.1f}%)")
    print(f"Near-black   : {dark.sum()} ({100*dark.sum()/total:.1f}%)")

    # Sample some purple pixels
    ys, xs = np.where(purple)
    if len(ys) > 0:
        indices = np.linspace(0, len(ys) - 1, min(8, len(ys)), dtype=int)
        print("Sample purple pixels (R,G,B):")
        for i in indices:
            print(f"  [{ys[i]},{xs[i]}] = ({arr[ys[i],xs[i],0]},{arr[ys[i],xs[i],1]},{arr[ys[i],xs[i],2]})")


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    mode = sys.argv[1]
    input_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3]) if len(sys.argv) > 3 else input_path

    arr = load(input_path)

    if mode == "preview":
        preview(arr)
    elif mode == "purple-disk":
        result, zeroed = remove_purple_disk(arr)
        print(f"Zeroed {zeroed} purple-background pixels")
        save(result, output_path)
    elif mode == "rect-frame":
        result, zeroed = remove_rect_frame(arr)
        print(f"Zeroed {zeroed} outside-circle pixels")
        save(result, output_path)
    else:
        print(f"Unknown mode: {mode}. Use: purple-disk | rect-frame | preview")
        sys.exit(1)


if __name__ == "__main__":
    main()
