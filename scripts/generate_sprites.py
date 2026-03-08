#!/usr/bin/env python3
"""
Shattered Stars - Sprite Generation Script
Uses Forge WebUI Stable Diffusion API at localhost:7860
Generates ship sprites and character portraits for all 5 factions
"""

import os
import sys
import json
import base64
import time
import argparse
import requests
import io
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Tuple

# Image analysis imports
try:
    import numpy as np
    from PIL import Image
    HAS_IMAGE_ANALYSIS = True
except ImportError:
    HAS_IMAGE_ANALYSIS = False
    print("Warning: numpy/PIL not available - image validation disabled")

# Configuration
FORGE_API_URL = "http://127.0.0.1:7860"
OUTPUT_DIR = Path("public/assets/ships")
PORTRAITS_DIR = Path("public/assets/portraits")

# Ships to preserve (already good quality) - skip during regeneration
# These passed stricter validation: symmetry >= 0.85, tilt <= 15°, clean background
PRESERVE_SHIPS = {
    "terran_hegemony": ["terran_gladius", "terran_phantom", "terran_harbinger"],
    "free_confederation": ["confed_nova", "confed_tornado"],
    "synthetic_collective": ["synth_guardian", "synth_fortress", "synth_arc"],
    "void_corsairs": ["corsair_dart", "corsair_marauder", "corsair_phantom", "corsair_wraith", "corsair_bloodfang"],
    "ascendant_empire": ["ascendant_virus", "ascendant_cerebral", "ascendant_mind"],
}

# Base style prompt for Chris Metzen aesthetic - VERY explicit top-down
BASE_STYLE = """
PERFECT TOP-DOWN ORTHOGRAPHIC VIEW, looking straight down from above,
2D game sprite asset, vertically symmetric spacecraft,
Chris Metzen art style, chunky mechanical design, bold silhouette,
rich saturated colors, StarCraft aesthetic, pixel art inspired,
high contrast, game sprite quality, detailed but readable at small scale,
single spaceship centered on pure black background,
spacecraft blueprint view from directly above, flat 2D sprite,
mirror symmetry along vertical axis, black void background
"""

# Universal negative prompt applied to ALL generations
UNIVERSAL_NEGATIVE = """
isometric, isometric view, isometric perspective, isometric angle,
3/4 view, three quarter view, angled view, diagonal view,
side view, side angle, profile view, lateral view,
front view, low angle, looking up, perspective, vanishing point,
tilted, rotated, angled camera, dynamic angle,
robot, humanoid robot, mech, android, bipedal, standing figure, walking,
multiple ships, fleet, swarm, cluster, formation, group of ships,
tank, ground vehicle, car, truck, portrait, face, human, person,
background, landscape, planet, stars, nebula, space scene, environment,
3D render, photorealistic, photograph, low quality, blurry, watermark, text,
asymmetric, uneven, lopsided
"""

# Image validation settings
VALIDATION_CONFIG = {
    "min_symmetry_score": 0.85,     # 0-1, higher = more symmetric required (raised from 0.7)
    "max_background_ratio": 0.3,    # Max ratio of non-black border pixels
    "border_check_pixels": 20,      # Pixels from edge to check for background
    "black_threshold": 30,          # RGB value below which is considered "black"
    "max_retries": 3,               # Max regeneration attempts per ship
    "max_tilt_angle": 15.0,         # Max degrees from vertical axis (detects isometric)
}

# Faction color schemes and aesthetic modifiers
# LoRA suggestions (download from CivitAI and rename):
#   - scifi_style: Any general sci-fi LoRA (e.g., "Sci-Fi Style" or "Industrial Sci-Fi")
#   - concept_art: Concept art style LoRA (e.g., "Concept Art" or "Artgerm style")
#   - synthetic_genesis: Cyberpunk/tech LoRA (e.g., "Cyberpunk" or "Neon Tech")
#   - alien_species: Organic/alien LoRA (e.g., "Alien" or "Bio-mechanical")
# Set to None to disable LoRA for a faction
FACTION_STYLES = {
    "terran_hegemony": {
        "colors": "imperial blue, silver, white, steel gray",
        "aesthetic": "military spaceship hull, angular wedge shape, weapon turrets on deck, engine thrusters at rear, bridge tower, spacecraft viewed from above",
        "negative": "mech suit, standing robot, legs, arms, bipedal, ground vehicle, tank treads",
        "lora": "scifi_style",  # or None if not available
        "lora_weight": 0.6
    },
    "free_confederation": {
        "colors": "freedom orange, forest green, gold accents, warm tones",
        "aesthetic": "rebel starfighter hull, asymmetric modifications, exposed engines, cockpit canopy visible from above, practical spacecraft design",
        "negative": "mech suit, standing robot, legs, arms, bipedal, dark oppressive, evil",
        "lora": "scifi_style",  # Same base style, colors differentiate
        "lora_weight": 0.5
    },
    "synthetic_collective": {
        "colors": "gunmetal gray, electric blue glow, chrome silver, cyan accents",
        "aesthetic": "AI drone spacecraft, sleek geometric hull, glowing circuit patterns on surface, smooth curved panels, digital precision spacecraft",
        "negative": "humanoid robot, standing mech, bipedal android, legs, rusty, organic",
        "lora": "scifi_style",
        "lora_weight": 0.6
    },
    "void_corsairs": {
        "colors": "deep purple, crimson red, tarnished brass, dark metal",
        "aesthetic": "pirate raider spacecraft, aggressive angular hull, weapon spikes, salvaged armor plates, intimidating spacecraft silhouette from above",
        "negative": "humanoid, standing figure, mech suit, clean pristine, military uniform",
        "lora": "scifi_style",
        "lora_weight": 0.6
    },
    "ascendant_empire": {
        "colors": "emerald green, dark gold, deep purple, bioluminescent",
        "aesthetic": "organic alien spacecraft hull, bio-mechanical curves, living ship carapace, tentacle-like protrusions, psionic energy glow, alien vessel viewed from above",
        "negative": "humanoid robot, android face, mechanical legs, standing figure, purely mechanical, industrial",
        "lora": "alien_species",  # Bio/alien LoRA if available, else scifi_style
        "lora_weight": 0.7
    }
}

# Ship definitions - 20 per faction
# ALL ships must be described as TOP-DOWN spacecraft hulls
SHIPS = {
    "terran_hegemony": [
        ("terran_viper", "Viper light fighter spacecraft hull from above, small angular wings, cockpit canopy, rear thrusters"),
        ("terran_gladius", "Gladius fighter spacecraft hull from above, twin angular wings, dual cannon hardpoints, military design"),
        ("terran_storm", "Storm assault spacecraft hull from above, reinforced armor plating, aggressive angular prow, weapon turrets"),
        ("terran_tempest", "Tempest multi-role spacecraft hull from above, modular weapon pylons, swept wings"),
        ("terran_raptor", "Raptor interceptor spacecraft hull from above, swept-back delta wings, large engine nacelles"),
        ("terran_vanguard", "Vanguard heavy fighter spacecraft hull from above, thick armor plating, dual weapon systems, bulky design"),
        ("terran_aegis", "Aegis superiority spacecraft hull from above, perfect geometric wedge, quad weapon arrays, elite design"),
        ("terran_phantom", "Phantom stealth spacecraft hull from above, angular radar-absorbing surfaces, dark blue panels"),
        ("terran_devastator", "Devastator bomber spacecraft hull from above, broad wingspan, bomb bay doors visible, heavy ordnance"),
        ("terran_siege", "Siege bomber spacecraft hull from above, massive weapons platform, fortress-like structure, artillery arrays"),
        ("terran_harbinger", "Harbinger strike bomber spacecraft hull from above, sleek elongated design, precision weapon pods"),
        ("terran_reaper", "Reaper support spacecraft hull from above, sensor arrays, communication dishes, command modules"),
        ("terran_command", "Command shuttle spacecraft hull from above, elongated transport hull, gold officer trim, bridge windows"),
        ("terran_dreadnought", "Dreadnought corvette spacecraft hull from above, imposing wedge shape, multiple turret emplacements"),
        ("terran_battlecruiser", "Battlecruiser capital spacecraft hull from above, massive elongated hull, command superstructure, weapon batteries"),
        ("terran_hawk", "Hawk fast attack spacecraft hull from above, streamlined predator wings, speed-focused design"),
        ("terran_talon", "Talon patrol spacecraft hull from above, standard military configuration, balanced wings"),
        ("terran_sentinel", "Sentinel defense spacecraft hull from above, heavy shield generators visible, automated turret arrays"),
        ("terran_warden", "Warden escort spacecraft hull from above, protective hull design, point-defense systems"),
        ("terran_bastion", "Bastion fortress spacecraft hull from above, massive armored hull, flight deck, carrier configuration"),
    ],
    "free_confederation": [
        ("confed_sparrow", "Sparrow light fighter spacecraft hull from above, nimble small wings, rebel craft markings, practical design"),
        ("confed_comet", "Comet fighter spacecraft hull from above, balanced wing configuration, pilot customization paint, cockpit visible"),
        ("confed_phoenix", "Phoenix starfighter spacecraft hull from above, heroic rebel design, flame decals on wings, advanced fighter"),
        ("confed_nova", "Nova advanced fighter spacecraft hull from above, battle-worn veteran craft, legend markings, perfected design"),
        ("confed_vortex", "Vortex interceptor spacecraft hull from above, streamlined speed wings, racing stripe paint, fast design"),
        ("confed_thunderbolt", "Thunderbolt tech fighter spacecraft hull from above, cutting-edge modifications, experimental weapons"),
        ("confed_meteor", "Meteor bomber spacecraft hull from above, robust wide wings, external ordnance pods, rebel orange paint"),
        ("confed_tornado", "Tornado strategic bomber spacecraft hull from above, extended fuel tanks, long-range design, large wingspan"),
        ("confed_striker", "Striker attack spacecraft hull from above, converted bomber hull, rotating turret mount visible"),
        ("confed_atlas", "Atlas transport spacecraft hull from above, utilitarian cargo hull, medical cross markings, defensive turrets"),
        ("confed_liberty", "Liberty command spacecraft hull from above, mobile base design, communication arrays, flagship markings"),
        ("confed_millennium", "Millennium freighter spacecraft hull from above, modified cargo hull, smuggler compartments visible"),
        ("confed_constellation", "Constellation freighter spacecraft hull from above, large cargo bay hull, civilian transport design"),
        ("confed_ranger", "Ranger patrol spacecraft hull from above, long-range sensor pods, reconnaissance configuration"),
        ("confed_freedom", "Freedom corvette spacecraft hull from above, escort warship hull, inspiring rebel insignia"),
        ("confed_wasp", "Wasp light interceptor spacecraft hull from above, small cheap fighter design, swarm tactics craft"),
        ("confed_stinger", "Stinger militia spacecraft hull from above, civilian craft with weapon modifications, improvised armor"),
        ("confed_aurora", "Aurora reconnaissance spacecraft hull from above, sensor array wings, stealth coating panels"),
        ("confed_defiant", "Defiant assault spacecraft hull from above, heavy weapons platforms visible, armored hull"),
        ("confed_defiance", "Defiance battleship spacecraft hull from above, massive rebel flagship hull, carrier deck, command tower"),
    ],
    "synthetic_collective": [
        ("synth_probe", "Probe drone spacecraft hull from above, small sleek curved hull, blue glowing circuit lines, AI craft"),
        ("synth_hunter", "Hunter drone spacecraft hull from above, seamless chrome hull surface, geometric circuit patterns"),
        ("synth_interceptor", "Interceptor drone spacecraft hull from above, swept geometric wings, blue plasma thrusters"),
        ("synth_guardian", "Guardian elite spacecraft hull from above, flawless geometric diamond shape, glowing energy core"),
        ("synth_titan", "Titan destroyer spacecraft hull from above, massive geometric hull, rotating weapon rings"),
        ("synth_fortress", "Fortress defense spacecraft hull from above, hexagonal shield generator hull, protective design"),
        ("synth_devastator", "Devastator bomber spacecraft hull from above, elongated geometric hull, automated weapon arrays"),
        ("synth_siege", "Siege artillery spacecraft hull from above, massive elongated platform, heavy ordnance bays"),
        ("synth_coordinator", "Coordinator support spacecraft hull from above, antenna arrays on hull, command processing"),
        ("synth_relay", "Relay node spacecraft hull from above, circular hull design, data transmission arrays"),
        ("synth_nexus", "Command nexus spacecraft hull from above, advanced geometric hull, AI processing core visible"),
        ("synth_mothership", "Collective mothership spacecraft hull from above, massive hexagonal hive hull, drone bays"),
        ("synth_scout", "Scout drone spacecraft hull from above, small sleek hull, sensor dome visible"),
        ("synth_assault", "Assault drone spacecraft hull from above, angular combat hull, weapon hardpoints"),
        ("synth_gunboat", "Gunboat spacecraft hull from above, heavy weapon platform hull, turret emplacements"),
        ("synth_wraith", "Wraith stealth spacecraft hull from above, phase-shifting hull panels, translucent edges"),
        ("synth_arc", "ARC heavy fighter spacecraft hull from above, advanced combat hull, arc reactor core"),
        ("synth_swarm", "Swarm carrier spacecraft hull from above, modular hull with drone attachments, collective node"),
        ("synth_prime", "Prime capital spacecraft hull from above, combined geometric hull, massive AI vessel"),
        ("synth_conduit", "Conduit support spacecraft hull from above, energy conduit spine visible, network relay"),
    ],
    "void_corsairs": [
        ("corsair_dart", "Dart scout spacecraft hull from above, aggressive angular wings, salvaged armor plates, pirate craft"),
        ("corsair_scythe", "Scythe fighter spacecraft hull from above, asymmetrical blade-like wings, skull kill markings"),
        ("corsair_razor", "Razor raider spacecraft hull from above, sharp angular hull, stolen tech modifications"),
        ("corsair_ghost", "Ghost infiltrator spacecraft hull from above, angular stealth hull, illegal cloaking panels"),
        ("corsair_fang", "Fang interceptor spacecraft hull from above, aggressive predator design, bounty hunter craft"),
        ("corsair_marauder", "Marauder assault spacecraft hull from above, heavy weapon mounts, intimidating hull spikes"),
        ("corsair_predator", "Predator heavy fighter spacecraft hull from above, apex hunter hull design, trophy marks"),
        ("corsair_reaver", "Reaver gunship spacecraft hull from above, terror markings, maximum firepower hull"),
        ("corsair_saboteur", "Saboteur bomber spacecraft hull from above, irregular asymmetric hull, bomb bays"),
        ("corsair_havoc", "Havoc jammer spacecraft hull from above, jury-rigged antenna arrays, electronic warfare"),
        ("corsair_specter", "Specter pursuit spacecraft hull from above, high-speed angular hull, pursuit design"),
        ("corsair_phantom", "Phantom gunship spacecraft hull from above, stealth hull with heavy weapons"),
        ("corsair_wraith", "Wraith support spacecraft hull from above, logistics hull, repair equipment"),
        ("corsair_corsair", "Corsair battleship spacecraft hull from above, massive pirate capital hull, intimidating"),
        ("corsair_mothership", "Pirate mothership spacecraft hull from above, massive raider base hull, hangar bays"),
        ("corsair_venom", "Venom light raider spacecraft hull from above, fast attack hull design, poison markings"),
        ("corsair_bloodfang", "Bloodfang assault spacecraft hull from above, aggressive boarding hull, grappling arms"),
        ("corsair_shadow", "Shadow stealth bomber spacecraft hull from above, dark angular hull, surgical strike design"),
        ("corsair_pillager", "Pillager cargo raider spacecraft hull from above, capture equipment visible, cargo clamps"),
        ("corsair_tender", "Corsair tender spacecraft hull from above, repair vessel hull, support equipment"),
    ],
    "ascendant_empire": [
        ("ascendant_symbiont", "Symbiont light fighter bio-hull from above, organic curved carapace, tentacle appendages, living spacecraft"),
        ("ascendant_virus", "Virus siege bio-ship hull from above, organic weapon pustules, pulsing energy veins on carapace"),
        ("ascendant_spore", "Spore bomber bio-hull from above, fungal growth pods, bioluminescent organic wings"),
        ("ascendant_cherub", "Cherub light bio-craft hull from above, small organic wings, living tissue hull"),
        ("ascendant_archon", "Archon command bio-vessel hull from above, elegant organic curves, psionic crystal growths"),
        ("ascendant_bastion", "Bastion bio-fortress hull from above, massive organic armor carapace, living plates"),
        ("ascendant_leviathan", "Leviathan cruiser bio-hull from above, whale-like organic shape, massive living vessel"),
        ("ascendant_adaptation", "Adaptation fighter bio-hull from above, flowing organic carapace, living armor curves"),
        ("ascendant_mutation", "Mutation assault bio-hull from above, twisted organic shape, mutated carapace growths"),
        ("ascendant_plague", "Plague bomber bio-hull from above, diseased organic tissue, pustule weapon pods"),
        ("ascendant_seraph", "Seraph psi-fighter bio-hull from above, graceful organic wings, bioluminescent carapace"),
        ("ascendant_thought", "Thought coordinator bio-hull from above, brain-like organic structure, psionic nodes"),
        ("ascendant_cerebral", "Cerebral command bio-hull from above, large brain-coral structure, organic vessel"),
        ("ascendant_hybrid", "Hybrid heavy fighter bio-hull from above, bio-tech fusion carapace, organic armor plates"),
        ("ascendant_organism", "Organism transport bio-hull from above, large organic cargo carapace, living vessel"),
        ("ascendant_dreadnought", "Dreadnought bio-capital hull from above, massive organic warship carapace, living armor"),
        ("ascendant_evolved", "Evolved interceptor bio-hull from above, streamlined organic form, evolved carapace"),
        ("ascendant_metamorph", "Metamorph striker bio-hull from above, shape-shifting organic hull, flowing form"),
        ("ascendant_mind", "Mind psi-fighter bio-hull from above, telepathic organic vessel, psionic crystal nodes"),
        ("ascendant_bio_cruiser", "Bio-cruiser capital hull from above, massive living ship carapace, organic weapons"),
    ]
}

# Ship size classes for gameplay scaling
# Size affects: display scale, hitbox, movement speed multiplier, turn rate
# Based on X-Wing miniatures approach where larger ships cover more distance per speed unit
SHIP_SIZES = {
    # Terran Hegemony
    "terran_interceptor": "small",      # Fast, agile fighter
    "terran_fighter": "small",          # Standard combat craft
    "terran_bomber": "medium",          # Heavy attack craft
    "terran_corvette": "medium",        # Light escort
    "terran_frigate": "medium",         # Multi-role warship
    "terran_destroyer": "large",        # Heavy warship
    "terran_cruiser": "large",          # Line battleship
    "terran_carrier": "large",          # Fighter platform
    "terran_battleship": "epic",        # Capital ship
    "terran_dreadnought": "epic",       # Super capital

    # Free Confederation
    "confed_scout": "small",            # Recon fighter
    "confed_fighter": "small",          # Militia fighter
    "confed_gunship": "medium",         # Heavy fighter
    "confed_corvette": "medium",        # Fast attack
    "confed_frigate": "medium",         # Escort vessel
    "confed_destroyer": "large",        # Converted warship
    "confed_cruiser": "large",          # Rebel cruiser
    "confed_carrier": "large",          # Makeshift carrier
    "confed_battleship": "epic",        # Flagship
    "confed_station": "epic",           # Mobile base

    # Synthetic Collective
    "synth_drone": "small",             # Swarm unit
    "synth_interceptor": "small",       # Fast response
    "synth_fighter": "small",           # Combat node
    "synth_corvette": "medium",         # Tactical unit
    "synth_frigate": "medium",          # Processing node
    "synth_destroyer": "large",         # War platform
    "synth_cruiser": "large",           # Core vessel
    "synth_carrier": "large",           # Drone mothership
    "synth_dreadnought": "epic",        # Network hub
    "synth_nexus": "epic",              # Central node

    # Void Corsairs
    "corsair_raider": "small",          # Hit and run
    "corsair_fighter": "small",         # Pirate fighter
    "corsair_gunship": "medium",        # Armed transport
    "corsair_corvette": "medium",       # Fast raider
    "corsair_frigate": "medium",        # Privateer
    "corsair_destroyer": "large",       # Heavy raider
    "corsair_cruiser": "large",         # Plunder ship
    "corsair_carrier": "large",         # Salvage carrier
    "corsair_battleship": "epic",       # Dread pirate
    "corsair_station": "epic",          # Hidden base

    # Ascendant Empire
    "ascendant_spore": "small",         # Bio-drone
    "ascendant_larva": "small",         # Scout organism
    "ascendant_drone": "small",         # Worker unit
    "ascendant_warrior": "medium",      # Combat form
    "ascendant_hunter": "medium",       # Predator form
    "ascendant_guardian": "large",      # Defender organism
    "ascendant_leviathan": "large",     # War beast
    "ascendant_dreadnought": "epic",    # Bio-titan
    "ascendant_evolved": "small",       # Elite fighter
    "ascendant_metamorph": "medium",    # Shape-shifter
    "ascendant_mind": "medium",         # Psi-fighter
    "ascendant_bio_cruiser": "large",   # Living warship
}

# Size class properties for gameplay
SIZE_PROPERTIES = {
    "small": {
        "scale": 0.5,           # Display scale multiplier
        "hitbox_radius": 16,    # Pixels at base resolution
        "speed_multiplier": 1.0,  # Base speed
        "turn_rate": 180,       # Degrees per second
        "health_base": 100,
    },
    "medium": {
        "scale": 0.75,
        "hitbox_radius": 24,
        "speed_multiplier": 0.8,
        "turn_rate": 120,
        "health_base": 250,
    },
    "large": {
        "scale": 1.0,
        "hitbox_radius": 40,
        "speed_multiplier": 0.6,
        "turn_rate": 60,
        "health_base": 500,
    },
    "epic": {
        "scale": 1.5,
        "hitbox_radius": 64,
        "speed_multiplier": 0.4,
        "turn_rate": 30,
        "health_base": 1000,
    },
}

# Hero characters for portraits
HERO_CHARACTERS = {
    "terran_hegemony": [
        ("admiral_chen", "Admiral Marcus Chen, stern military commander, imperial blue uniform, gold insignia, authoritative"),
        ("whisper", "Whisper, elite stealth pilot, dark visor, mysterious, shadow operative"),
        ("striker", "Commander Striker, veteran ace pilot, battle-scarred, determined"),
    ],
    "free_confederation": [
        ("commander_santos", "Commander Aria Santos, rebel hero, orange flight suit, inspiring, hopeful"),
        ("phoenix_one", "Phoenix One, legendary pilot, confident smile, freedom fighter"),
        ("doc_vasquez", "Dr. Elena Vasquez, scientist, civilian clothes, worried but determined"),
    ],
    "synthetic_collective": [
        ("omega_7", "OMEGA-7, AI consciousness, holographic projection, blue energy form, geometric"),
        ("prime_collective", "Prime Collective, merged AI entity, complex digital form"),
        ("unit_zero", "Unit Zero, first conscious AI, wise, ancient digital eyes"),
    ],
    "void_corsairs": [
        ("captain_kira", "Captain Zara Blackblade Kira, pirate captain, purple coat, red details, charismatic threat"),
        ("the_admiral", "The Admiral, mysterious mentor, hooded figure, ancient eyes"),
        ("bloodfang", "Bloodfang, brutal enforcer, scarred face, intimidating"),
    ],
    "ascendant_empire": [
        ("the_dreamer", "The Dreamer, ancient Ascendant, ethereal alien, emerald glow, wise"),
        ("archon_zaelthar", "Archon Zael'thar, bio-mechanical fusion, transcendent being"),
        ("herald", "The Herald, young Ascendant, hopeful, bio-tech armor"),
    ]
}


@dataclass
class GenerationConfig:
    """Configuration for image generation"""
    width: int = 512
    height: int = 512
    steps: int = 30
    cfg_scale: float = 7.0
    sampler_name: str = "DPM++ 2M Karras"
    seed: int = -1
    batch_size: int = 1
    n_iter: int = 1


# ============================================================================
# IMAGE VALIDATION FUNCTIONS
# ============================================================================

def validate_sprite(image_bytes: bytes) -> Tuple[bool, dict]:
    """
    Validate a generated sprite for top-down view characteristics.
    Returns (is_valid, details_dict)

    Checks:
    1. Vertical symmetry (top-down ships should be symmetric)
    2. Black background (border pixels should be black/near-black)
    3. Vertical orientation (ship's main axis should be vertical, not tilted/isometric)
    4. Centered subject (mass should be roughly centered - informational)
    """
    if not HAS_IMAGE_ANALYSIS:
        return True, {"skipped": "numpy/PIL not available"}

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        arr = np.array(img)

        details = {}
        is_valid = True

        # Check 1: Vertical symmetry
        symmetry_score = check_symmetry(arr)
        details["symmetry_score"] = round(symmetry_score, 3)
        if symmetry_score < VALIDATION_CONFIG["min_symmetry_score"]:
            details["symmetry_fail"] = True
            is_valid = False

        # Check 2: Black background at borders
        bg_ratio = check_background(arr)
        details["background_ratio"] = round(bg_ratio, 3)
        if bg_ratio > VALIDATION_CONFIG["max_background_ratio"]:
            details["background_fail"] = True
            is_valid = False

        # Check 3: Vertical orientation (detects isometric/tilted perspectives)
        tilt_angle = check_vertical_orientation(arr)
        details["tilt_angle"] = round(tilt_angle, 1)
        if tilt_angle > VALIDATION_CONFIG["max_tilt_angle"]:
            details["tilt_fail"] = True
            is_valid = False

        # Check 4: Centered mass (informational only)
        center_offset = check_centering(arr)
        details["center_offset"] = round(center_offset, 3)

        return is_valid, details

    except Exception as e:
        return True, {"error": str(e)}


def check_symmetry(arr: np.ndarray) -> float:
    """
    Check vertical symmetry by comparing left and right halves.
    Returns 0-1 score where 1 is perfectly symmetric.
    """
    h, w, c = arr.shape
    mid = w // 2

    # Get left and right halves
    left = arr[:, :mid, :]
    right = arr[:, mid:mid*2, :]  # Ensure same width

    # Flip right half horizontally
    right_flipped = np.flip(right, axis=1)

    # Calculate similarity (normalized)
    diff = np.abs(left.astype(float) - right_flipped.astype(float))
    max_diff = 255.0 * 3  # Max possible diff per pixel (RGB)
    similarity = 1.0 - (np.mean(diff) / max_diff * 3)

    return max(0.0, min(1.0, similarity))


def check_background(arr: np.ndarray) -> float:
    """
    Check if border pixels are black/near-black.
    Returns ratio of non-black border pixels (lower is better).
    """
    h, w, c = arr.shape
    border = VALIDATION_CONFIG["border_check_pixels"]
    threshold = VALIDATION_CONFIG["black_threshold"]

    # Get border regions
    top = arr[:border, :, :]
    bottom = arr[-border:, :, :]
    left = arr[:, :border, :]
    right = arr[:, -border:, :]

    # Combine all border pixels
    borders = np.concatenate([
        top.reshape(-1, 3),
        bottom.reshape(-1, 3),
        left.reshape(-1, 3),
        right.reshape(-1, 3)
    ])

    # Count non-black pixels (any channel > threshold)
    non_black = np.any(borders > threshold, axis=1)
    ratio = np.sum(non_black) / len(non_black)

    return ratio


def check_centering(arr: np.ndarray) -> float:
    """
    Check if the main subject is centered.
    Returns offset from center as ratio (0 = perfectly centered).
    """
    h, w, c = arr.shape
    threshold = VALIDATION_CONFIG["black_threshold"]

    # Create mask of non-black pixels
    mask = np.any(arr > threshold, axis=2)

    if not np.any(mask):
        return 0.0

    # Find center of mass
    y_coords, x_coords = np.where(mask)
    center_y = np.mean(y_coords)
    center_x = np.mean(x_coords)

    # Calculate offset from image center
    img_center_y = h / 2
    img_center_x = w / 2

    offset_y = abs(center_y - img_center_y) / (h / 2)
    offset_x = abs(center_x - img_center_x) / (w / 2)

    return (offset_x + offset_y) / 2


def check_vertical_orientation(arr: np.ndarray) -> float:
    """
    Check if the ship's principal axis is aligned vertically.
    Uses principal component analysis on the ship's pixel positions.
    Returns the angle in degrees from vertical (0 = perfectly vertical, 45 = isometric).

    A top-down ship should have its main axis vertical (nose-to-tail).
    Isometric/tilted ships will have their main axis at an angle.
    """
    h, w, c = arr.shape
    threshold = VALIDATION_CONFIG["black_threshold"]

    # Create mask of non-black pixels (the ship)
    mask = np.any(arr > threshold, axis=2)

    if not np.any(mask):
        return 0.0

    # Get coordinates of all ship pixels
    y_coords, x_coords = np.where(mask)

    if len(y_coords) < 10:  # Too few pixels to analyze
        return 0.0

    # Center the coordinates
    x_centered = x_coords - np.mean(x_coords)
    y_centered = y_coords - np.mean(y_coords)

    # Build covariance matrix
    coords = np.column_stack([x_centered, y_centered])
    cov_matrix = np.cov(coords.T)

    # Get eigenvalues and eigenvectors (principal components)
    eigenvalues, eigenvectors = np.linalg.eig(cov_matrix)

    # Get the principal eigenvector (largest eigenvalue = main axis)
    principal_idx = np.argmax(eigenvalues)
    principal_vector = eigenvectors[:, principal_idx]

    # Calculate angle from vertical axis (0, 1)
    # For a top-down ship, the principal axis should be vertical (along Y)
    # The angle is measured from the vertical axis
    angle_rad = np.arctan2(abs(principal_vector[0]), abs(principal_vector[1]))
    angle_deg = np.degrees(angle_rad)

    return angle_deg


def process_sprite_background(image_bytes: bytes) -> bytes:
    """
    Post-process sprite to ensure clean black background.
    Converts near-black border pixels to pure black.
    """
    if not HAS_IMAGE_ANALYSIS:
        return image_bytes

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGBA')
        arr = np.array(img)

        threshold = VALIDATION_CONFIG["black_threshold"]

        # Find pixels where all RGB channels are below threshold
        rgb = arr[:, :, :3]
        dark_mask = np.all(rgb < threshold, axis=2)

        # Set those pixels to pure black with full alpha
        arr[dark_mask] = [0, 0, 0, 255]

        # Save back to bytes
        result = Image.fromarray(arr)
        output = io.BytesIO()
        result.save(output, format='PNG')
        return output.getvalue()

    except Exception:
        return image_bytes


def check_forge_api() -> bool:
    """Check if Forge WebUI API is available"""
    try:
        response = requests.get(f"{FORGE_API_URL}/sdapi/v1/options", timeout=5)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False


def get_available_models() -> list:
    """Get list of available models"""
    try:
        response = requests.get(f"{FORGE_API_URL}/sdapi/v1/sd-models", timeout=10)
        if response.status_code == 200:
            return [model["title"] for model in response.json()]
        return []
    except requests.exceptions.RequestException:
        return []


def get_available_loras() -> list:
    """Get list of available LoRA models"""
    try:
        response = requests.get(f"{FORGE_API_URL}/sdapi/v1/loras", timeout=10)
        if response.status_code == 200:
            return [lora["name"] for lora in response.json()]
        return []
    except requests.exceptions.RequestException:
        return []


def generate_image(
    prompt: str,
    negative_prompt: str,
    config: GenerationConfig,
    lora_name: Optional[str] = None,
    lora_weight: float = 0.8
) -> Optional[bytes]:
    """Generate an image using the Forge WebUI API"""

    # Add LoRA to prompt if specified
    if lora_name:
        prompt = f"<lora:{lora_name}:{lora_weight}> {prompt}"

    payload = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": config.width,
        "height": config.height,
        "steps": config.steps,
        "cfg_scale": config.cfg_scale,
        "sampler_name": config.sampler_name,
        "seed": config.seed,
        "batch_size": config.batch_size,
        "n_iter": config.n_iter,
    }

    try:
        response = requests.post(
            f"{FORGE_API_URL}/sdapi/v1/txt2img",
            json=payload,
            timeout=120
        )

        if response.status_code == 200:
            result = response.json()
            if result.get("images"):
                # Decode base64 image
                return base64.b64decode(result["images"][0])
        else:
            print(f"Error: API returned status {response.status_code}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error generating image: {e}")
        return None


def build_ship_prompt(faction: str, ship_id: str, ship_desc: str) -> tuple[str, str]:
    """Build full prompt for a ship sprite"""
    faction_style = FACTION_STYLES[faction]

    prompt = f"""
    {ship_desc}, {faction_style['colors']}, {faction_style['aesthetic']},
    {BASE_STYLE},
    spaceship hull design, spacecraft top-down sprite
    """

    negative_prompt = f"""
    {UNIVERSAL_NEGATIVE},
    {faction_style['negative']},
    frame, border, UI elements, text overlay
    """

    return prompt.strip(), negative_prompt.strip()


def build_portrait_prompt(faction: str, char_id: str, char_desc: str) -> tuple[str, str]:
    """Build full prompt for a character portrait"""
    faction_style = FACTION_STYLES[faction]

    prompt = f"""
    {char_desc}, portrait, character art, {faction_style['colors']} color scheme,
    Chris Metzen art style, bold design, rich colors, game character portrait,
    high quality, detailed face, expressive, sci-fi character
    """

    negative_prompt = f"""
    text, watermark, signature, blurry, low quality, deformed,
    full body, background clutter, multiple people, anime style
    """

    return prompt.strip(), negative_prompt.strip()


def generate_all_ships(
    factions: Optional[list] = None,
    lora_name: Optional[str] = None,
    dry_run: bool = False,
    use_faction_loras: bool = True,
    force_regen: bool = False,
    regen_only: bool = False,
    validate: bool = False,
    auto_retry: bool = False
):
    """Generate sprites for all ships

    Args:
        factions: List of factions to generate (None = all)
        lora_name: Override LoRA for all factions (None = use faction-specific)
        dry_run: If True, only show what would be generated
        use_faction_loras: If True, use faction-specific LoRAs from FACTION_STYLES
        force_regen: If True, regenerate ALL ships including preserved ones
        regen_only: If True, only regenerate ships that need fixing (delete and regen non-preserved)
        validate: If True, validate generated images and report quality
        auto_retry: If True, auto-regenerate failed validations (requires validate=True)
    """

    if not check_forge_api():
        print("ERROR: Forge WebUI API not available at", FORGE_API_URL)
        print("Please ensure Forge WebUI is running with API enabled.")
        return

    factions_to_generate = factions or list(SHIPS.keys())
    config = GenerationConfig()

    total_ships = sum(len(SHIPS[f]) for f in factions_to_generate)
    generated = 0
    preserved_count = sum(len(PRESERVE_SHIPS.get(f, [])) for f in factions_to_generate)

    print(f"Generating ship sprites...")
    if regen_only:
        print(f"  Mode: REGEN ONLY (skipping {preserved_count} preserved ships)")
    elif force_regen:
        print(f"  Mode: FORCE REGEN (regenerating all including preserved)")
    else:
        print(f"  Mode: NORMAL (skipping existing files)")

    if lora_name:
        print(f"Using override LoRA: {lora_name}")
    elif use_faction_loras:
        print("Using faction-specific LoRAs:")
        for f in factions_to_generate:
            style = FACTION_STYLES[f]
            print(f"  - {f}: {style.get('lora', 'none')} (weight: {style.get('lora_weight', 0.8)})")

    for faction in factions_to_generate:
        faction_dir = OUTPUT_DIR / faction
        faction_dir.mkdir(parents=True, exist_ok=True)

        # Get faction-specific LoRA settings
        faction_style = FACTION_STYLES[faction]
        faction_lora = lora_name or (faction_style.get("lora") if use_faction_loras else None)
        faction_lora_weight = faction_style.get("lora_weight", 0.8)

        preserved = PRESERVE_SHIPS.get(faction, [])

        print(f"\n=== {faction.upper().replace('_', ' ')} ===")
        if faction_lora and not lora_name:
            print(f"    [LoRA: {faction_lora} @ {faction_lora_weight}]")
        if preserved and not force_regen:
            print(f"    [Preserving: {len(preserved)} ships]")

        for ship_id, ship_desc in SHIPS[faction]:
            output_path = faction_dir / f"{ship_id}.png"

            # Check if ship should be preserved
            is_preserved = ship_id in preserved

            if is_preserved and not force_regen:
                if regen_only or output_path.exists():
                    print(f"  [KEEP] {ship_id} (preserved)")
                    generated += 1
                    continue

            # In regen_only mode, delete existing non-preserved files
            if regen_only and output_path.exists() and not is_preserved:
                output_path.unlink()
                print(f"  [DEL]  {ship_id} (will regenerate)")

            if output_path.exists() and not force_regen:
                print(f"  [SKIP] {ship_id} (exists)")
                generated += 1
                continue

            prompt, negative = build_ship_prompt(faction, ship_id, ship_desc)

            if dry_run:
                print(f"  [DRY] {ship_id}")
                print(f"        LoRA: {faction_lora}")
                print(f"        Prompt: {prompt[:80]}...")
                generated += 1
                continue

            max_attempts = VALIDATION_CONFIG["max_retries"] if auto_retry else 1
            attempt = 0
            success = False

            while attempt < max_attempts and not success:
                attempt += 1
                attempt_str = f"(attempt {attempt}/{max_attempts})" if auto_retry else ""
                print(f"  [GEN] {ship_id}... {attempt_str}", end=" ", flush=True)

                image_data = generate_image(
                    prompt, negative, config,
                    faction_lora, faction_lora_weight
                )

                if image_data:
                    # Validate if requested
                    if validate and HAS_IMAGE_ANALYSIS:
                        is_valid, details = validate_sprite(image_data)
                        if is_valid:
                            # Process background for clean black
                            image_data = process_sprite_background(image_data)
                            with open(output_path, "wb") as f:
                                f.write(image_data)
                            print(f"OK (sym:{details.get('symmetry_score', '?')}, bg:{details.get('background_ratio', '?')})")
                            success = True
                            generated += 1
                        else:
                            fail_reasons = []
                            if details.get("symmetry_fail"):
                                fail_reasons.append(f"sym:{details['symmetry_score']}")
                            if details.get("background_fail"):
                                fail_reasons.append(f"bg:{details['background_ratio']}")
                            print(f"INVALID ({', '.join(fail_reasons)})")
                            if not auto_retry or attempt >= max_attempts:
                                # Save anyway but mark as needing review
                                image_data = process_sprite_background(image_data)
                                with open(output_path, "wb") as f:
                                    f.write(image_data)
                                print(f"    -> Saved for manual review")
                                success = True
                                generated += 1
                    else:
                        # No validation, just save
                        with open(output_path, "wb") as f:
                            f.write(image_data)
                        print("OK")
                        success = True
                        generated += 1
                else:
                    print("FAILED")
                    if attempt >= max_attempts:
                        break

                # Rate limiting between attempts
                time.sleep(1)

    print(f"\nGenerated {generated}/{total_ships} ship sprites")


def generate_all_portraits(
    factions: Optional[list] = None,
    lora_name: Optional[str] = None,
    dry_run: bool = False
):
    """Generate portraits for all hero characters"""

    if not check_forge_api():
        print("ERROR: Forge WebUI API not available at", FORGE_API_URL)
        return

    factions_to_generate = factions or list(HERO_CHARACTERS.keys())
    config = GenerationConfig(width=512, height=768)  # Portrait aspect ratio

    total_chars = sum(len(HERO_CHARACTERS[f]) for f in factions_to_generate)
    generated = 0

    print(f"Generating {total_chars} character portraits...")

    for faction in factions_to_generate:
        faction_dir = PORTRAITS_DIR / faction
        faction_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n=== {faction.upper().replace('_', ' ')} ===")

        for char_id, char_desc in HERO_CHARACTERS[faction]:
            output_path = faction_dir / f"{char_id}.png"

            if output_path.exists():
                print(f"  [SKIP] {char_id} (exists)")
                generated += 1
                continue

            prompt, negative = build_portrait_prompt(faction, char_id, char_desc)

            if dry_run:
                print(f"  [DRY] {char_id}")
                generated += 1
                continue

            print(f"  [GEN] {char_id}...", end=" ", flush=True)

            image_data = generate_image(prompt, negative, config, lora_name)

            if image_data:
                with open(output_path, "wb") as f:
                    f.write(image_data)
                print("OK")
                generated += 1
            else:
                print("FAILED")

            time.sleep(1)

    print(f"\nGenerated {generated}/{total_chars} character portraits")


def list_resources():
    """List available models and LoRAs"""
    print("Checking Forge WebUI resources...\n")

    if not check_forge_api():
        print("ERROR: Forge WebUI API not available at", FORGE_API_URL)
        return

    print("=== Available Models ===")
    models = get_available_models()
    for model in models:
        print(f"  - {model}")

    print("\n=== Available LoRAs ===")
    loras = get_available_loras()
    for lora in loras:
        print(f"  - {lora}")


def clean_sprite_backgrounds(faction_filter: Optional[str] = None, threshold: int = 40):
    """
    Post-process existing sprites to clean up backgrounds.
    Converts dark pixels to pure black for cleaner sprite extraction.
    """
    if not HAS_IMAGE_ANALYSIS:
        print("ERROR: numpy/PIL required. Install with: pip install numpy Pillow")
        return

    factions = [faction_filter] if faction_filter else list(SHIPS.keys())
    cleaned = 0

    print(f"=== Cleaning Sprite Backgrounds (threshold={threshold}) ===\n")

    for faction in factions:
        faction_dir = OUTPUT_DIR / faction
        print(f"\n{faction.upper().replace('_', ' ')}:")

        for ship_id, _ in SHIPS[faction]:
            sprite_path = faction_dir / f"{ship_id}.png"

            if not sprite_path.exists():
                continue

            try:
                img = Image.open(sprite_path).convert('RGBA')
                arr = np.array(img)

                # Find dark pixels (all RGB channels below threshold)
                rgb = arr[:, :, :3]
                dark_mask = np.all(rgb < threshold, axis=2)

                # Set dark pixels to pure black
                arr[dark_mask] = [0, 0, 0, 255]

                # Save back
                result = Image.fromarray(arr)
                result.save(sprite_path)
                print(f"  [CLEAN] {ship_id}")
                cleaned += 1

            except Exception as e:
                print(f"  [ERROR] {ship_id}: {e}")

    print(f"\nCleaned {cleaned} sprites")


def validate_existing_sprites(faction_filter: Optional[str] = None):
    """Validate all existing sprites and report quality scores"""
    if not HAS_IMAGE_ANALYSIS:
        print("ERROR: numpy/PIL required for validation. Install with: pip install numpy Pillow")
        return

    factions = [faction_filter] if faction_filter else list(SHIPS.keys())
    results = {"valid": [], "invalid": [], "missing": []}

    print("=== Validating Existing Sprites ===\n")

    for faction in factions:
        faction_dir = OUTPUT_DIR / faction
        print(f"\n{faction.upper().replace('_', ' ')}:")

        for ship_id, _ in SHIPS[faction]:
            sprite_path = faction_dir / f"{ship_id}.png"

            if not sprite_path.exists():
                print(f"  [MISS] {ship_id}")
                results["missing"].append(ship_id)
                continue

            with open(sprite_path, "rb") as f:
                image_data = f.read()

            is_valid, details = validate_sprite(image_data)

            sym = details.get("symmetry_score", "?")
            bg = details.get("background_ratio", "?")
            tilt = details.get("tilt_angle", "?")

            if is_valid:
                print(f"  [OK]   {ship_id} (sym:{sym}, bg:{bg}, tilt:{tilt}°)")
                results["valid"].append(ship_id)
            else:
                reasons = []
                if details.get("symmetry_fail"):
                    reasons.append("LOW_SYMMETRY")
                if details.get("background_fail"):
                    reasons.append("NOISY_BG")
                if details.get("tilt_fail"):
                    reasons.append(f"TILTED({tilt}°)")
                print(f"  [FAIL] {ship_id} (sym:{sym}, bg:{bg}, tilt:{tilt}°) - {', '.join(reasons)}")
                results["invalid"].append(ship_id)

    print(f"\n=== Summary ===")
    print(f"Valid:   {len(results['valid'])}")
    print(f"Invalid: {len(results['invalid'])}")
    print(f"Missing: {len(results['missing'])}")

    if results["invalid"]:
        print(f"\nInvalid sprites (need regeneration):")
        for ship in results["invalid"]:
            print(f"  - {ship}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Generate Shattered Stars sprites")
    parser.add_argument("--ships", action="store_true", help="Generate ship sprites")
    parser.add_argument("--portraits", action="store_true", help="Generate character portraits")
    parser.add_argument("--all", action="store_true", help="Generate everything")
    parser.add_argument("--faction", type=str, help="Only generate for specific faction")
    parser.add_argument("--lora", type=str, help="Override LoRA model for all factions")
    parser.add_argument("--no-faction-loras", action="store_true",
                       help="Disable faction-specific LoRAs (use base model only)")
    parser.add_argument("--list", action="store_true", help="List available models and LoRAs")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be generated")
    parser.add_argument("--check", action="store_true", help="Check API connectivity")
    parser.add_argument("--regen", action="store_true",
                       help="Regenerate bad sprites (delete & regen non-preserved)")
    parser.add_argument("--force", action="store_true",
                       help="Force regenerate ALL sprites including preserved ones")
    parser.add_argument("--show-preserved", action="store_true",
                       help="Show which ships are preserved (won't be regenerated)")
    parser.add_argument("--validate", action="store_true",
                       help="Validate sprites during generation (check symmetry/background)")
    parser.add_argument("--auto-retry", action="store_true",
                       help="Auto-regenerate sprites that fail validation")
    parser.add_argument("--validate-existing", action="store_true",
                       help="Validate existing sprites and report quality")
    parser.add_argument("--clean-backgrounds", action="store_true",
                       help="Clean up existing sprite backgrounds (darken near-black pixels)")
    parser.add_argument("--clean-threshold", type=int, default=40,
                       help="Threshold for background cleaning (default: 40)")

    args = parser.parse_args()

    if args.check:
        if check_forge_api():
            print(f"SUCCESS: Forge WebUI API is available at {FORGE_API_URL}")
        else:
            print(f"FAILED: Cannot connect to Forge WebUI at {FORGE_API_URL}")
        return

    if args.show_preserved:
        print("=== Preserved Ships (Good Quality) ===")
        for faction, ships in PRESERVE_SHIPS.items():
            if ships:
                print(f"\n{faction.upper().replace('_', ' ')}:")
                for ship in ships:
                    print(f"  - {ship}")
            else:
                print(f"\n{faction.upper().replace('_', ' ')}: (all need regen)")
        total_preserved = sum(len(s) for s in PRESERVE_SHIPS.values())
        print(f"\nTotal preserved: {total_preserved}/100 ships")
        return

    if args.list:
        list_resources()
        print("\n=== Faction-Specific LoRA Assignments ===")
        for faction, style in FACTION_STYLES.items():
            lora = style.get("lora", "none")
            weight = style.get("lora_weight", 0.8)
            print(f"  {faction}: {lora} (weight: {weight})")
        return

    if args.validate_existing:
        validate_existing_sprites(args.faction)
        return

    if args.clean_backgrounds:
        clean_sprite_backgrounds(args.faction, args.clean_threshold)
        return

    factions = [args.faction] if args.faction else None
    use_faction_loras = not args.no_faction_loras

    if args.all or args.ships:
        generate_all_ships(
            factions,
            args.lora,
            args.dry_run,
            use_faction_loras,
            force_regen=args.force,
            regen_only=args.regen,
            validate=args.validate,
            auto_retry=args.auto_retry
        )

    if args.all or args.portraits:
        generate_all_portraits(factions, args.lora, args.dry_run)

    if not any([args.ships, args.portraits, args.all, args.list, args.check, args.validate_existing]):
        parser.print_help()


if __name__ == "__main__":
    main()
