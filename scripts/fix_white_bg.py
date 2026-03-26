#!/usr/bin/env python3
"""
Post-process a ship sprite: replace white/near-white background pixels
with pure black so ADD blend mode makes them transparent in-game.

Pixels where min(R, G, B) > 200 are treated as background and zeroed.
"""
from PIL import Image
import numpy as np
from pathlib import Path
import sys

INPUT  = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("public/assets/ships/free_confederation/confed_wasp.png")
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else INPUT

img = Image.open(INPUT).convert("RGB")
arr = np.array(img, dtype=np.uint8)

# Pixels that are clearly background: all channels very bright (near-white),
# or very near-white gray.  Ship colors: orange (R high, G mid, B low),
# green (R low, G mid, B low) — none of those have min > 200.
background_mask = np.min(arr, axis=2) > 200
removed = int(background_mask.sum())
arr[background_mask] = [0, 0, 0]

result = Image.fromarray(arr)
result.save(OUTPUT)
print(f"Zeroed {removed} background pixels -> saved {OUTPUT}")
