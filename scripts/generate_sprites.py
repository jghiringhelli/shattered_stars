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
import requests
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

# Configuration
FORGE_API_URL = "http://localhost:7860"
OUTPUT_DIR = Path("public/assets/ships")
PORTRAITS_DIR = Path("public/assets/portraits")

# Base style prompt for Chris Metzen aesthetic
BASE_STYLE = """
Chris Metzen art style, chunky mechanical design, bold silhouette,
rich saturated colors, StarCraft aesthetic, pixel art inspired,
high contrast, game sprite quality, detailed but readable at small scale,
top-down spaceship sprite, transparent background, centered composition
"""

# Faction color schemes and aesthetic modifiers
FACTION_STYLES = {
    "terran_hegemony": {
        "colors": "imperial blue, silver, white",
        "aesthetic": "military precision, authoritarian engineering, disciplined geometric design",
        "negative": "organic, chaotic, asymmetrical",
        "lora": "industrial_scifi",  # Industrial military look
        "lora_weight": 0.75
    },
    "free_confederation": {
        "colors": "freedom orange, forest green, gold",
        "aesthetic": "heroic rebel design, practical modifications, hope and determination",
        "negative": "dark, oppressive, rigid military",
        "lora": "concept_art",  # Heroic concept art style
        "lora_weight": 0.7
    },
    "synthetic_collective": {
        "colors": "gunmetal gray, electric blue, chrome",
        "aesthetic": "AI precision, digital consciousness, seamless geometric curves, circuit patterns",
        "negative": "organic, chaotic, rusty, worn",
        "lora": "synthetic_genesis",  # Synthetic/AI aesthetic
        "lora_weight": 0.8
    },
    "void_corsairs": {
        "colors": "deep purple, crimson red, brass",
        "aesthetic": "pirate chaos, intimidating spikes, salvaged parts, aggressive angular",
        "negative": "clean, organized, military standard",
        "lora": "scifi_style",  # General scifi for varied pirate ships
        "lora_weight": 0.7
    },
    "ascendant_empire": {
        "colors": "emerald green, dark gold, deep purple",
        "aesthetic": "bio-mechanical fusion, organic curves with technology, psionic energy glows, living spaceship, alien vessel",
        "negative": "robot, humanoid, mechanical robot, android, isometric view, multiple ships, swarm, cluster, purely mechanical, industrial, angular, face, human",
        "lora": "alien_species",  # Alien/organic bio-tech
        "lora_weight": 0.8
    }
}

# Ship definitions - 20 per faction
SHIPS = {
    "terran_hegemony": [
        ("terran_viper", "Viper light fighter, small agile craft, basic weapon pods, single pilot cockpit"),
        ("terran_gladius", "Gladius standard fighter, angular twin-wing design, dual laser cannons"),
        ("terran_storm", "Storm assault fighter, reinforced armor, aggressive nose design"),
        ("terran_tempest", "Tempest multi-role fighter, modular weapon mounts"),
        ("terran_raptor", "Raptor interceptor, swept-back wings, enhanced engines, speed-focused"),
        ("terran_vanguard", "Vanguard heavy fighter, bulky reinforced design, dual weapon systems"),
        ("terran_aegis", "Aegis superiority fighter, perfect geometric design, quad weapon arrays"),
        ("terran_phantom", "Phantom stealth fighter, angular cloaking surfaces, dark blue"),
        ("terran_devastator", "Devastator bomber, broad wings, heavy ordnance pods, missile racks"),
        ("terran_siege", "Siege bomber platform, massive weapon arrays, fortress-like"),
        ("terran_harbinger", "Harbinger strike bomber, sleek and deadly, precision munitions"),
        ("terran_reaper", "Reaper support craft, communication arrays, command modules"),
        ("terran_command", "Command shuttle, elongated officer transport, gold trim"),
        ("terran_dreadnought", "Dreadnought corvette, imposing wedge design, multiple turrets"),
        ("terran_battlecruiser", "Battlecruiser capital ship, massive command tower, weapon batteries"),
        ("terran_hawk", "Hawk fast attack craft, streamlined predator design"),
        ("terran_talon", "Talon patrol fighter, standard military configuration"),
        ("terran_sentinel", "Sentinel defense platform, heavy shields, automated turrets"),
        ("terran_warden", "Warden escort ship, protective configuration, anti-missile systems"),
        ("terran_bastion", "Bastion fortress ship, massive armored hull, carrier configuration"),
    ],
    "free_confederation": [
        ("confed_sparrow", "Sparrow light fighter, nimble rebel craft, practical design"),
        ("confed_comet", "Comet fighter, balanced wings, pilot personalization visible"),
        ("confed_phoenix", "Phoenix starfighter, advanced rebel fighter, hero markings"),
        ("confed_nova", "Nova advanced fighter, perfected through battle, legendary"),
        ("confed_vortex", "Vortex interceptor, streamlined speed-focused, racing stripes"),
        ("confed_thunderbolt", "Thunderbolt tech fighter, cutting-edge modifications"),
        ("confed_meteor", "Meteor bomber, robust with external ordnance, rebel colors"),
        ("confed_tornado", "Tornado strategic bomber, extended range, SLAM drive"),
        ("confed_striker", "Comet striker, converted bomber, rotating weapon mount"),
        ("confed_atlas", "Atlas transport, utilitarian with defensive mods, medical markings"),
        ("confed_liberty", "Liberty command ship, mobile base, democratic leadership"),
        ("confed_millennium", "Millennium transport, modified freighter, smuggler aesthetic"),
        ("confed_constellation", "Constellation freighter, large cargo hauler"),
        ("confed_ranger", "Ranger patrol fighter, long-range reconnaissance"),
        ("confed_freedom", "Freedom corvette, escort warship, inspiring presence"),
        ("confed_wasp", "Wasp light interceptor, cheap swarm fighter"),
        ("confed_stinger", "Stinger militia fighter, visible modifications"),
        ("confed_aurora", "Aurora reconnaissance, sensor arrays, stealth coating"),
        ("confed_defiant", "Defiant assault ship, heavy weapons platform"),
        ("confed_defiance", "Defiance battleship, symbol of rebellion, command carrier"),
    ],
    "synthetic_collective": [
        ("synth_probe", "Probe light drone, sleek curves, blue energy lines"),
        ("synth_hunter", "Hunter drone, seamless surfaces, circuit patterns"),
        ("synth_interceptor", "Interceptor drone, enhanced mobility, blue propulsion"),
        ("synth_guardian", "Guardian elite fighter, flawless geometric design"),
        ("synth_titan", "Titan destroyer, rotating weapon platforms, heavy"),
        ("synth_fortress", "Fortress defensive drone, shield generators"),
        ("synth_devastator", "Devastator bomber drone, automated weapon arrays"),
        ("synth_siege", "Siege heavy drone, massive ordnance capacity"),
        ("synth_coordinator", "Coordinator support, communication arrays, command"),
        ("synth_relay", "Relay ship, network node, data processing"),
        ("synth_nexus", "Command nexus, advanced AI processing center"),
        ("synth_mothership", "Collective mothership, massive hive mind vessel"),
        ("synth_scout", "Scout drone, small reconnaissance, sensor suite"),
        ("synth_assault", "Assault drone, mid-range combat drone"),
        ("synth_gunboat", "Gunboat destroyer, heavy weapons platform"),
        ("synth_wraith", "Wraith stealth drone, phase-shift technology"),
        ("synth_arc", "ARC heavy fighter, advanced combat unit"),
        ("synth_swarm", "Swarm node, multiple small drones attached"),
        ("synth_prime", "Prime unit, megazord configuration, combined AI"),
        ("synth_conduit", "Conduit support, energy transfer, network backbone"),
    ],
    "void_corsairs": [
        ("corsair_dart", "Dart scout, aggressive angular, salvaged parts"),
        ("corsair_scythe", "Scythe fighter, asymmetrical weapons, kill markings"),
        ("corsair_razor", "Razor raider, enhanced with stolen tech"),
        ("corsair_ghost", "Ghost infiltrator, illegal cloaking mods"),
        ("corsair_fang", "Fang interceptor, Mandalorian-style bounty hunter"),
        ("corsair_marauder", "Marauder assault ship, intimidating firepower"),
        ("corsair_predator", "Predator heavy fighter, apex hunter design"),
        ("corsair_reaver", "Reaver gunship, maximum intimidation, terror markings"),
        ("corsair_saboteur", "Saboteur bomber, irregular design, chaos ordnance"),
        ("corsair_havoc", "Havoc jammer, jury-rigged EW systems"),
        ("corsair_specter", "Specter pursuit craft, high speed intercept"),
        ("corsair_phantom", "Phantom gunship, stealth and firepower"),
        ("corsair_wraith", "Wraith support, pirate logistics"),
        ("corsair_corsair", "Corsair battleship, pirate capital, intimidating"),
        ("corsair_mothership", "Pirate mothership, massive raider base"),
        ("corsair_venom", "Venom light raider, fast attack"),
        ("corsair_bloodfang", "Bloodfang assault, aggressive boarding craft"),
        ("corsair_shadow", "Shadow stealth bomber, surgical strikes"),
        ("corsair_pillager", "Pillager cargo raider, cargo capture equipment"),
        ("corsair_tender", "Corsair tender, repair and resupply vessel"),
    ],
    "ascendant_empire": [
        # GOOD: symbiont, virus, spore, cherub, archon, bastion, leviathan - keep similar
        ("ascendant_symbiont", "Symbiont light fighter, organic curves with tech, living spaceship, bio-mechanical hull, tentacle-like appendages"),
        ("ascendant_virus", "Virus siege ship, bio-strategic weapons, organic hull plating, living vessel, pulsing energy veins"),
        ("ascendant_spore", "Spore bomber, organic weapon pods, fungal growth patterns, living ship, bioluminescent"),
        ("ascendant_cherub", "Cherub light bio-craft, small symbiotic fighter, organic wings, living cockpit"),
        ("ascendant_archon", "Archon command vessel, transcendent bio-ship, elegant organic curves, psionic energy emanating"),
        ("ascendant_bastion", "Ascendant bastion, bio-fortress capital ship, massive organic hull, living armor plates"),
        ("ascendant_leviathan", "Leviathan cruiser, massive bio-mechanical whale-like ship, organic armor, living vessel"),

        # FIXED: These looked robotic or wrong - emphasize organic/bio nature, top-down view
        ("ascendant_adaptation", "Adaptation fighter, organic living spaceship, flowing bio-armor curves, NO robot, alien organic hull, top-down spaceship sprite"),
        ("ascendant_mutation", "Mutation assault craft, mutated organic hull, twisted bio-mechanical living ship, pulsing flesh armor, NOT a robot"),
        ("ascendant_plague", "Plague heavy bomber, diseased organic hull, pustule weapon pods, living bio-ship, NOT mechanical robot"),
        ("ascendant_seraph", "Seraph psi-warrior ship, graceful organic wings, bio-luminescent hull, angelic living spacecraft, NOT a humanoid"),
        ("ascendant_thought", "Thought coordinator, psionic organic vessel, brain-like bio-structures, living ship hull, NOT a robot face"),
        ("ascendant_cerebral", "Cerebral command ship, single large organic vessel, brain-coral structure, bio-ship NOT a cluster of objects"),

        # FIXED: These were isometric or swarm-like - ensure single ship top-down
        ("ascendant_hybrid", "Hybrid heavy fighter, single bio-tech fusion ship, organic armor plating, top-down spaceship view"),
        ("ascendant_organism", "Organism transport, single large bio-cargo vessel, organic hull, top-down ship sprite"),
        ("ascendant_dreadnought", "Ascendant dreadnought, single massive bio-capital ship, organic armor, top-down view NOT isometric"),
        ("ascendant_evolved", "Evolved interceptor, single streamlined bio-form ship, organic hull, NOT a swarm"),
        ("ascendant_metamorph", "Metamorph striker, single shape-shifting bio-ship, organic flowing hull, NOT multiple ships"),

        # Keep but improve
        ("ascendant_mind", "Mind psi-fighter, telepathic bio-ship, organic hull with psionic crystals, living spacecraft"),
        ("ascendant_bio_cruiser", "Bio-cruiser, living capital ship, organic armor and weapons, massive bio-vessel"),
    ]
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
    {BASE_STYLE}
    """

    negative_prompt = f"""
    text, watermark, signature, blurry, low quality, deformed,
    {faction_style['negative']}, person, human, face,
    multiple ships, background clutter, frame, border
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
    use_faction_loras: bool = True
):
    """Generate sprites for all ships

    Args:
        factions: List of factions to generate (None = all)
        lora_name: Override LoRA for all factions (None = use faction-specific)
        dry_run: If True, only show what would be generated
        use_faction_loras: If True, use faction-specific LoRAs from FACTION_STYLES
    """

    if not check_forge_api():
        print("ERROR: Forge WebUI API not available at", FORGE_API_URL)
        print("Please ensure Forge WebUI is running with API enabled.")
        return

    factions_to_generate = factions or list(SHIPS.keys())
    config = GenerationConfig()

    total_ships = sum(len(SHIPS[f]) for f in factions_to_generate)
    generated = 0

    print(f"Generating {total_ships} ship sprites...")
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

        print(f"\n=== {faction.upper().replace('_', ' ')} ===")
        if faction_lora and not lora_name:
            print(f"    [LoRA: {faction_lora} @ {faction_lora_weight}]")

        for ship_id, ship_desc in SHIPS[faction]:
            output_path = faction_dir / f"{ship_id}.png"

            if output_path.exists():
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

            print(f"  [GEN] {ship_id}...", end=" ", flush=True)

            image_data = generate_image(
                prompt, negative, config,
                faction_lora, faction_lora_weight
            )

            if image_data:
                with open(output_path, "wb") as f:
                    f.write(image_data)
                print("OK")
                generated += 1
            else:
                print("FAILED")

            # Rate limiting
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


def main():
    """Main entry point"""
    import argparse

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
    parser.add_argument("--regenerate", action="store_true",
                       help="Regenerate existing sprites (don't skip)")

    args = parser.parse_args()

    if args.check:
        if check_forge_api():
            print(f"SUCCESS: Forge WebUI API is available at {FORGE_API_URL}")
        else:
            print(f"FAILED: Cannot connect to Forge WebUI at {FORGE_API_URL}")
        return

    if args.list:
        list_resources()
        print("\n=== Faction-Specific LoRA Assignments ===")
        for faction, style in FACTION_STYLES.items():
            lora = style.get("lora", "none")
            weight = style.get("lora_weight", 0.8)
            print(f"  {faction}: {lora} (weight: {weight})")
        return

    factions = [args.faction] if args.faction else None
    use_faction_loras = not args.no_faction_loras

    if args.all or args.ships:
        generate_all_ships(
            factions,
            args.lora,
            args.dry_run,
            use_faction_loras
        )

    if args.all or args.portraits:
        generate_all_portraits(factions, args.lora, args.dry_run)

    if not any([args.ships, args.portraits, args.all, args.list, args.check]):
        parser.print_help()


if __name__ == "__main__":
    main()
