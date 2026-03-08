"""
Stable Diffusion Generation Script for Shattered Stars
Interacts with A1111 WebUI API to generate faction-specific art assets
"""

import requests
import base64
import json
import os
import time
from pathlib import Path
from typing import Optional, Dict, List, Any

SD_URL = "http://127.0.0.1:7860"
OUTPUT_BASE = Path(r"C:\StableDiffusion\shattered-stars-assets")

# Shared negative prompt for all Shattered Stars assets
NEGATIVE_PROMPT = (
    "blurry, low quality, watermark, signature, text, jpeg artifacts, "
    "photorealistic photograph, cartoon, anime, chibi, pixel art, "
    "low contrast, washed out colors, muddy palette, grey, dull, "
    "deformed, bad anatomy, disfigured, poorly drawn, mutated, extra limbs"
)

# Base generation parameters
BASE_PARAMS = {
    "negative_prompt": NEGATIVE_PROMPT,
    "sampler_name": "DPM++ 2M Karras",
    "steps": 28,
    "cfg_scale": 8.5,
    "width": 512,
    "height": 512,
    "batch_size": 1,
    "n_iter": 1,
    "save_images": True,
    "send_images": True,
}

# Faction-specific LoRA recipes
FACTION_LORAS = {
    "terran": "<lora:scifi_artist:0.7> <lora:industrial_scifi:0.6>",
    "confed": "<lora:scifi_artist:0.7> <lora:industrial_scifi:0.4>",
    "synthetic": "<lora:scifi_artist:0.6> <lora:synthetic_genesis:0.6>",
    "corsair": "<lora:scifi_artist:0.8>",
    "ascendant": "<lora:scifi_artist:0.6>",
    "ascendant_portrait": "<lora:scifi_artist:0.6> <lora:alien_species:0.7>",
    "environment": "<lora:scifi_environments:0.6> <lora:space_nebula:0.7>",
    "emblem": "<lora:concept_art:0.8>",
}

# Faction color palettes for reference
FACTION_COLORS = {
    "terran": {
        "primary": "#1E40AF",  # Imperial Blue
        "secondary": "#C0C0C0",  # Silver
        "accent": "#F8FAFC",  # White
        "energy": "#00BFFF",  # Electric Blue
    },
    "confed": {
        "primary": "#EA580C",  # Rebel Orange
        "secondary": "#166534",  # Forest Green
        "accent": "#CA8A04",  # Gold
        "energy": "#FACC15",  # Yellow
    },
    "synthetic": {
        "primary": "#374151",  # Gunmetal Gray
        "secondary": "#3B82F6",  # Electric Blue
        "accent": "#E5E7EB",  # Chrome
        "energy": "#22D3EE",  # Cyan
    },
    "corsair": {
        "primary": "#581C87",  # Deep Purple
        "secondary": "#991B1B",  # Crimson Red
        "accent": "#B8860B",  # Brass
        "energy": "#EC4899",  # Hot Pink
    },
    "ascendant": {
        "primary": "#059669",  # Emerald Green
        "secondary": "#92400E",  # Dark Gold
        "accent": "#0A0A0A",  # Obsidian Black
        "energy": "#84CC16",  # Lime
    },
}

# Ship prompt templates per faction
SHIP_PROMPTS = {
    "terran": (
        "cinematic sci-fi concept art, {ship_type}, "
        "polished steel hull with blue LED panel strips, symmetric turret rows, "
        "command bridge tower, white ceramic armor plating, imperial blue accents, "
        "disciplined military design, formation-oriented warship, "
        "dramatic lighting, deep space background, high contrast, vivid colors, "
        "digital painting, game asset"
    ),
    "confed": (
        "cinematic sci-fi concept art, {ship_type}, "
        "worn orange-painted hull with welded repair patches, exposed wiring, "
        "mismatched armor panels, custom nose art, improvised weapon mounts, "
        "forest green accent markings, gold trim on bridge, rugged practical design, "
        "dramatic lighting, deep space background, high contrast, vivid colors, "
        "digital painting, game asset"
    ),
    "synthetic": (
        "cinematic sci-fi concept art, {ship_type}, "
        "tessellating chrome hull segments, no visible rivets or seams, "
        "holographic projection nodes, electric blue fiber-optic web patterns, "
        "fractal antenna arrays, seamless gunmetal grey construction, "
        "calculated precision design, dramatic lighting, deep space background, "
        "high contrast, vivid electric blue glow, digital painting, game asset"
    ),
    "corsair": (
        "cinematic sci-fi concept art, {ship_type}, "
        "spiked prow, swept-back blade wings, exposed oversized engines, "
        "deep purple hull with crimson accent stripes, brass trophy fittings, "
        "skull motifs, alien tech grafted onto hull, scarred battle-worn armor, "
        "intimidating baroque design, dramatic lighting, deep space background, "
        "high contrast, vivid crimson and purple glow, digital painting, game asset"
    ),
    "ascendant": (
        "cinematic sci-fi concept art, {ship_type}, "
        "curved chitinous carapace hull, membrane solar wings, "
        "bioluminescent emerald green veins pulsing across surface, "
        "golden neural circuit patterns beneath obsidian bone armor, "
        "crystalline psionic nodes along spine, grown not built, "
        "living alien warship, dramatic lighting, deep space background, "
        "high contrast, vivid green bioluminescence, digital painting, game asset"
    ),
}

# Style anchor ship descriptions (signature ship per faction)
STYLE_ANCHOR_SHIPS = {
    "terran": "massive angular battlecruiser with imposing command tower",
    "confed": "asymmetric retrofitted freighter flagship with character",
    "synthetic": "geometric modular drone carrier with perfect symmetry",
    "corsair": "aggressive predatory raider with trophy-adorned hull",
    "ascendant": "organic biomechanical capital ship with living hull",
}


def verify_api() -> bool:
    """Verify A1111 API is running and check available models/LoRAs."""
    try:
        models = requests.get(f"{SD_URL}/sdapi/v1/sd-models", timeout=10).json()
        loras = requests.get(f"{SD_URL}/sdapi/v1/loras", timeout=10).json()
        options = requests.get(f"{SD_URL}/sdapi/v1/options", timeout=10).json()

        print("=== SD API Status ===")
        print(f"Current model: {options.get('sd_model_checkpoint', 'unknown')}")
        print(f"Available models: {[m['title'] for m in models]}")
        print(f"\nAvailable LoRAs ({len(loras)}):")

        lora_names = [l["name"] for l in loras]
        for name in lora_names:
            print(f"  - {name}")

        # Check for required LoRAs
        required_loras = [
            "scifi_artist",
            "industrial_scifi",
            "synthetic_genesis",
            "alien_species",
            "scifi_environments",
            "space_nebula",
            "concept_art",
        ]

        print("\n=== Required LoRA Check ===")
        missing = []
        for req in required_loras:
            found = any(req in name.lower() for name in lora_names)
            status = "FOUND" if found else "MISSING"
            print(f"  {req}: {status}")
            if not found:
                missing.append(req)

        if missing:
            print(f"\nWARNING: Missing LoRAs: {missing}")
            print("Some faction recipes may not work correctly.")
        else:
            print("\nAll required LoRAs found!")

        return True

    except requests.ConnectionError:
        print("ERROR: Cannot reach A1111 API at http://127.0.0.1:7860")
        print("Make sure the Docker container is running with --api flag")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False


def generate(
    prompt: str,
    output_path: Path,
    seed: int = -1,
    width: int = 512,
    height: int = 512,
    steps: int = 28,
    cfg_scale: float = 8.5,
    skip_lora: bool = False,
) -> Optional[Path]:
    """Generate a single image and save it. Returns the output filepath."""

    payload = {
        **BASE_PARAMS,
        "prompt": prompt,
        "seed": seed,
        "width": width,
        "height": height,
        "steps": steps,
        "cfg_scale": cfg_scale,
    }

    try:
        response = requests.post(f"{SD_URL}/sdapi/v1/txt2img", json=payload, timeout=120)
        response.raise_for_status()
        r = response.json()

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Save image
        with open(output_path, "wb") as f:
            f.write(base64.b64decode(r["images"][0]))

        # Save generation info
        info = json.loads(r["info"])
        info_path = output_path.with_suffix(".json")
        with open(info_path, "w") as f:
            json.dump(
                {
                    "prompt": prompt,
                    "negative_prompt": NEGATIVE_PROMPT,
                    "seed": info["seed"],
                    "steps": steps,
                    "cfg_scale": cfg_scale,
                    "width": width,
                    "height": height,
                },
                f,
                indent=2,
            )

        print(f"Saved: {output_path} (seed: {info['seed']})")
        return output_path

    except requests.exceptions.RequestException as e:
        print(f"ERROR generating image: {e}")
        return None


def generate_faction(
    prompt: str,
    faction: str,
    output_path: Path,
    **kwargs,
) -> Optional[Path]:
    """Generate an image with faction-specific LoRA recipe."""
    lora_tags = FACTION_LORAS.get(faction, "")
    full_prompt = f"{prompt} {lora_tags}"
    return generate(full_prompt, output_path, **kwargs)


def generate_batch(
    prompt: str,
    output_dir: Path,
    prefix: str,
    count: int = 5,
    faction: Optional[str] = None,
    **kwargs,
) -> List[Path]:
    """Generate multiple variations for selection."""
    paths = []
    output_dir.mkdir(parents=True, exist_ok=True)

    for i in range(count):
        path = output_dir / f"{prefix}_{i+1:02d}.png"
        if faction:
            result = generate_faction(prompt, faction, path, **kwargs)
        else:
            result = generate(prompt, path, **kwargs)

        if result:
            paths.append(result)
        time.sleep(1)  # Avoid overloading GPU

    return paths


def generate_style_anchors(count_per_faction: int = 10) -> Dict[str, List[Path]]:
    """
    Generate style anchor images for each faction.
    These establish the visual identity and should be curated by the user.
    """
    anchors = {}
    anchor_dir = OUTPUT_BASE / "style-anchors"

    for faction, ship_desc in STYLE_ANCHOR_SHIPS.items():
        print(f"\n=== Generating {faction.upper()} style anchors ===")

        prompt = SHIP_PROMPTS[faction].format(ship_type=ship_desc)
        faction_dir = anchor_dir / faction

        paths = generate_batch(
            prompt=prompt,
            output_dir=faction_dir,
            prefix=f"{faction}_anchor",
            count=count_per_faction,
            faction=faction,
        )

        anchors[faction] = paths
        print(f"Generated {len(paths)} anchors for {faction}")

    return anchors


def generate_ship_variants(
    faction: str,
    ship_type: str,
    ship_name: str,
    count: int = 8,
) -> List[Path]:
    """Generate variants of a specific ship type for a faction."""
    prompt = SHIP_PROMPTS[faction].format(ship_type=ship_type)
    output_dir = OUTPUT_BASE / f"{faction_to_dirname(faction)}" / "ships" / ship_name

    return generate_batch(
        prompt=prompt,
        output_dir=output_dir,
        prefix=ship_name,
        count=count,
        faction=faction,
    )


def faction_to_dirname(faction: str) -> str:
    """Convert faction key to directory name."""
    mapping = {
        "terran": "terran-hegemony",
        "confed": "free-confederation",
        "synthetic": "synthetic-collective",
        "corsair": "void-corsairs",
        "ascendant": "ascendant-empire",
    }
    return mapping.get(faction, faction)


def img2img_variant(
    input_path: Path,
    prompt: str,
    output_path: Path,
    denoising_strength: float = 0.4,
    faction: Optional[str] = None,
) -> Optional[Path]:
    """Create a variant of an existing image using img2img."""

    with open(input_path, "rb") as f:
        input_b64 = base64.b64encode(f.read()).decode()

    full_prompt = prompt
    if faction:
        full_prompt = f"{prompt} {FACTION_LORAS.get(faction, '')}"

    payload = {
        **BASE_PARAMS,
        "prompt": full_prompt,
        "init_images": [input_b64],
        "denoising_strength": denoising_strength,
    }

    try:
        response = requests.post(f"{SD_URL}/sdapi/v1/img2img", json=payload, timeout=120)
        response.raise_for_status()
        r = response.json()

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(base64.b64decode(r["images"][0]))

        print(f"Saved variant: {output_path}")
        return output_path

    except requests.exceptions.RequestException as e:
        print(f"ERROR generating variant: {e}")
        return None


def upscale(input_path: Path, output_path: Path, scale: int = 2) -> Optional[Path]:
    """Upscale an image using Real-ESRGAN."""

    with open(input_path, "rb") as f:
        input_b64 = base64.b64encode(f.read()).decode()

    payload = {
        "image": input_b64,
        "resize_mode": 0,
        "upscaling_resize": scale,
        "upscaler_1": "R-ESRGAN 4x+",
    }

    try:
        response = requests.post(
            f"{SD_URL}/sdapi/v1/extra-single-image", json=payload, timeout=120
        )
        response.raise_for_status()
        r = response.json()

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(base64.b64decode(r["image"]))

        print(f"Upscaled: {output_path}")
        return output_path

    except requests.exceptions.RequestException as e:
        print(f"ERROR upscaling: {e}")
        return None


# Quick test function
def test_generation():
    """Quick test to verify generation works."""
    print("Testing basic generation...")
    test_path = OUTPUT_BASE / "test_image.png"

    result = generate(
        prompt="simple spaceship, sci-fi, concept art, white background",
        output_path=test_path,
        steps=20,
    )

    if result:
        print(f"Test successful! Image saved to {result}")
    else:
        print("Test failed!")

    return result is not None


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        cmd = sys.argv[1]

        if cmd == "verify":
            verify_api()
        elif cmd == "test":
            if verify_api():
                test_generation()
        elif cmd == "anchors":
            if verify_api():
                count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
                generate_style_anchors(count)
        else:
            print(f"Unknown command: {cmd}")
            print("Usage: python sd_generate.py [verify|test|anchors]")
    else:
        print("Shattered Stars - SD Generation Script")
        print("Usage:")
        print("  python sd_generate.py verify  - Check API and LoRA status")
        print("  python sd_generate.py test    - Generate a test image")
        print("  python sd_generate.py anchors [count] - Generate style anchors")
