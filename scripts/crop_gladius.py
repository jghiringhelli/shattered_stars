#!/usr/bin/env python3
"""
Post-process terran_gladius: keep only the main ship body by finding the
largest connected bright-pixel blob and zeroing all isolated orbital objects.

The ship is one large connected mass; each orbital sphere/arrow is a small
isolated blob — connected-component analysis cleanly separates them.
"""
from PIL import Image
import numpy as np
from pathlib import Path
from scipy.ndimage import label

SRC = Path("public/assets/ships/terran_hegemony/terran_gladius.original.png")
OUT = Path("public/assets/ships/terran_hegemony/terran_gladius.png")

img = Image.open(SRC).convert("RGB")
arr = np.array(img)

# Binary: pixels clearly brighter than the dark ring (threshold per channel).
# The gray ring sits at ~30-50 per channel; ship panels are >80; spheres are >80.
# Threshold=55 excludes the ring so spheres become isolated from the ship.
bright = np.any(arr > 55, axis=2)

# Label connected components (8-connected neighbours)
structure = np.ones((3, 3), dtype=int)
labeled, num_features = label(bright, structure=structure)
print(f"Found {num_features} connected components")

# Keep only the LARGEST component (the ship)
sizes = np.bincount(labeled.ravel())
sizes[0] = 0                          # ignore background label
largest_label = sizes.argmax()
largest_size  = sizes[largest_label]
print(f"Largest component: label={largest_label}, size={largest_size}px")

# Zero pixels not in the largest component
keep_mask = labeled == largest_label
removed = int((bright & ~keep_mask).sum())
arr[~keep_mask] = [0, 0, 0]

result = Image.fromarray(arr)
result.save(OUT)
print(f"Saved {OUT}  ({removed} orbital/small-blob pixels removed)")




