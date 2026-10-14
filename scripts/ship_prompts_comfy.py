"""Prompt templates for ComfyUI ship art: faction design language x role x per-ship motif.

Pure data + string assembly (no I/O). The per-ship motif comes from ship_roster_comfy.motif_for.
"""
from ship_roster_comfy import Ship, motif_for

FACTION_STYLE = {
    "terran_hegemony": (
        "Terran Hegemony naval hull, disciplined angular wedge-shaped armour, uniform military design, "
        "hard straight edges, ordered hardpoints, cold blue engine glow"),
    "free_confederation": (
        "Free Confederation patchwork hull, salvaged mismatched armour plates, bolted-on modular pods and "
        "cargo containers, exposed girders and cables, weathered and field-repaired, warm amber engine glow"),
    "synthetic_collective": (
        "Synthetic Collective drone hull, geometric faceted modules, no cockpit, no windows, "
        "floating hull segments, lattice frame, machine-built swarm design, electric blue engine glow"),
    "void_corsairs": (
        "Void Corsair raider, asymmetrical scavenged hull, stolen mismatched armour, crude weapon mounts, "
        "jagged spikes and blades, scarred and battle-worn, illicit modifications, hot red engine glow"),
    "ascendant_empire": (
        "Ascendant Empire bio-ceramic hull, elegant sweeping curves and arcs, grown crystalline "
        "resonator spires, organic flowing surfaces, ornate filigree, glowing psionic lattice, emerald engine glow"),
}

PALETTE = {
    "terran_hegemony": "imperial blue and silver and white painted armour panels",
    "free_confederation": "freedom orange and deep green painted armour panels with gold trim",
    "synthetic_collective": "gunmetal and chrome armour with electric blue glowing seams",
    "void_corsairs": "deep purple and crimson painted armour with brass trim",
    "ascendant_empire": "emerald green and dark gold armour with deep purple accents",
}

ROLE_SHAPE = {
    "light_fighter": "small light compact one-person craft, short stubby hull, two small engines",
    "interceptor": "slender needle-thin fast interceptor, long narrow spine, swept spars and fins",
    "heavy_fighter": "heavy armoured strike craft, broad blocky hull, twin large engine pods",
    "bomber": "bulky bomber with exposed ordnance racks and torpedo bays, thick fuselage, big engine bank",
    "gunship": "heavy gunship bristling with cannons and turret hardpoints, broad armoured hull",
    "support": "support craft with radar dishes, antenna arrays and projector emitters, rounded utility hull",
    "capital": ("enormous capital warship, long spined hull, many turrets, hangar bays, "
                "bank of huge engines, tiny lights along the hull"),
}

NEGATIVE = (
    "fighter jet, airplane, aircraft, jet canopy, cockpit bubble, glass canopy, pilot, delta wing airliner, "
    "F-15, F-16, F-22, military jet, landing gear, runway, clouds, sky, atmosphere, horizon, ground, "
    "sunset, planet surface, terrain, rocks, desert, crashed wreck, landed, blueprint, schematic, "
    "character sheet, turnaround, concept sheet, multiple views, stars text, text, letters, watermark, logo, "
    "signature, frame, border, multiple ships, cropped, blurry, lowres, deformed, cartoon, anime, toy, miniature"
)

SPRITE_FRAME = (
    "a single sci-fi spaceship, top view, nose pointing up, floating in the black void of space, "
    "dark empty background, painted armour plates with bright metallic highlights, brightly lit hull, "
    "strong rim light, highly detailed, glowing engine exhaust"
)

ILLUSTRATION_FRAME = (
    "a single sci-fi spaceship, digital painting, dramatic three-quarter view, flying through empty deep space, "
    "dense starfield, colourful distant nebula, the curved edge of a distant planet far below, "
    "brightly lit by a nearby star, rim lighting, volumetric engine glow, detailed hull panels, cinematic"
)

LORA_TRIGGERS = {"scifi_style.safetensors": "science fiction style"}


def build_prompt(kind: str, ship: Ship, lora: str = "") -> str:
    """Assemble a positive prompt.

    :param kind: ``sprite`` (top-down, black backdrop) or ``illustration`` (3/4 view in space).
    :param ship: roster entry (faction, role, id, name).
    :param lora: LoRA file name whose trigger words are prepended; empty for none.
    :returns: the positive prompt text.
    """
    frame = SPRITE_FRAME if kind == "sprite" else ILLUSTRATION_FRAME
    parts = [LORA_TRIGGERS.get(lora, ""), frame, f"armour in {PALETTE[ship.faction]}",
             ROLE_SHAPE[ship.role], motif_for(ship), FACTION_STYLE[ship.faction]]
    return ", ".join(p for p in parts if p)
