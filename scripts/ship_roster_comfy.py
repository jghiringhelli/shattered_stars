"""Ship roster (from src/data/ShipDefinitions.ts) and per-ship design motifs derived from names and lore.

Motifs are short visual phrases: a hand-written override for the hero ships, otherwise the first two
WORD_MOTIFS entries matching a word of the ship's name or id (e.g. "Carrier" -> hangar bays).
"""
import re
from pathlib import Path
from typing import NamedTuple

REPO = Path(__file__).resolve().parent.parent
SHIP_DEFINITIONS = REPO / "src" / "data" / "ShipDefinitions.ts"
SHIP_PATTERN = re.compile(r'id: "(\w+)",\s+name: "([^"]+)",\s+faction: "(\w+)",\s+role: "(\w+)"')
GENERIC_MOTIF = "a unique distinctive silhouette"
MAX_MOTIFS = 2


class Ship(NamedTuple):
    ship_id: str
    name: str
    faction: str
    role: str


OVERRIDES = {
    "terran_viper": "needle prow, two forward-swept spars, twin thrusters, no wings",
    "terran_hammer": "blunt armoured prow, four torpedo pylons on thick armoured side pods",
    "terran_imperator": "long wedge-shaped battlecruiser, layered armour decks, command spire, broadside batteries",
    "confed_wasp": "tiny hull with oversized engine pods bolted on, orange stripe, mismatched side panel",
    "confed_phoenix": "heavy gun cradle slung under a cobbled hull, patched wings, painted phoenix emblem",
    "confed_independence": "carrier built from joined cargo modules, open hangar bays, spinal girder, radiators",
    "synth_drone": "small faceted diamond body, single glowing sensor eye, two floating wing blades",
    "synth_ravager": "armoured geometric core with four floating weapon pylons, glowing seams",
    "synth_nexus": "huge ring-and-spire lattice with a glowing core, floating armour plates, data-link antennae",
    "corsair_fang": "lopsided dart hull, tusk-like forward blades, one oversized engine, patched plates",
    "corsair_pillager": "stolen freighter hull converted to a gunboat, welded gun turrets, spiked ram prow",
    "corsair_galleon": "huge ship with sail-like solar vanes, tiered stolen hull sections, ram prow, cannon ports",
    "ascendant_cherub": "slim crescent hull, two curved resonator wing-arcs, glowing emerald crystal at the prow",
    "ascendant_judgment": "tall winged hull of curved bio-ceramic ribs, central crystal cannon, halo ring",
    "ascendant_sanctum": "cathedral-like carrier, soaring curved buttresses, crystal spires, radiant hangar arch",
}

WORD_MOTIFS = {
    "scout": "long sensor boom with a small dish", "recon": "long sensor boom with a big lens array",
    "carrier": "wide flight deck with open hangar bays and launch rails",
    "torpedo": "torpedo tubes in a blunt prow", "command": "tall command spire and comms masts",
    "battleship": "massive armoured hull with dorsal turret batteries",
    "battlecruiser": "long hull with broadside gun batteries", "cruiser": "long hull with broadside gun batteries",
    "frigate": "compact warship hull with a row of turrets", "destroyer": "lean hull with heavy forward cannons",
    "flagship": "ornate superstructure with command towers", "dreadnought": "colossal hull bristling with turrets and a ram prow",
    "tender": "repair gantries, cargo cradles and welding arms", "ecm": "jamming antenna array and sensor dishes",
    "stealth": "flat angular stealth plating with hidden lights", "night": "matte dark hull with tiny lights",
    "infiltrator": "flat low hull with grapple hooks", "platform": "armoured hull ringed by cannon hardpoints",
    "gunboat": "stubby hull with an oversized forward cannon", "node": "central relay sphere with antenna spikes",
    "relay": "central relay sphere with antenna spikes", "repair": "folded repair arms and welding lamps",
    "protocol": "armoured geometric core with floating weapon pylons",
    "colossus": "gigantic faceted core with orbiting armour plates", "overmind": "huge lattice sphere with drone cradles",
    "gestalt": "gigantic faceted core with orbiting armour plates", "terminus": "massive lattice hull with a spinal cannon",
    "conduit": "long energy conduit spine between two pods", "hunter": "forward hunting claws and sensor eye",
    "predator": "forward hunting claws and sensor eye", "stalker": "slender faceted hull with a long sensor spike",
    "eradicator": "heavy faceted core with big floating cannons", "annihilator": "heavy faceted core with big floating cannons",
    "devastator": "heavy faceted core with big floating cannons", "interceptor": "slim fast hull",
    "stiletto": "thin blade hull with a long needle prow", "javelin": "slim hull carrying one huge torpedo",
    "gladius": "short broad blade-shaped hull", "legionnaire": "plain disciplined hull with twin cannons",
    "centurion": "heavy armoured hull with a crest-like dorsal fin", "praetorian": "shielded guard hull with a heavy front plate",
    "thunderbolt": "zigzag lightning-shaped wings with ordnance", "raptor": "hooked talon-like prow",
    "bastion": "fortress hull with thick bulwark plates", "bulwark": "wide shield-like armour wall",
    "sentinel": "watchtower sensor mast", "guardian": "ring-shaped psionic lantern emitter",
    "harbinger": "long sensor spear", "consul": "tall command spire", "dominator": "wide flight deck with hangar bays",
    "executor": "heavy ram prow with forward batteries", "vindicator": "heavy armoured cruiser with broadside guns",
    "sparrow": "small hull with big side engine pods", "finch": "tiny hull with a long antenna",
    "kestrel": "swept hull with bolted-on engine pod", "owl": "big sensor eyes, dark matte hull",
    "raven": "dark slim hull with patched plates", "falcon": "swept hull with a forward cannon pod",
    "hawk": "angular hull with bolted-on gun pods", "eagle": "broad multi-role hull with cargo pods",
    "condor": "heavy hull with broad bolted-on armour", "albatross": "long span of racks holding big bombs",
    "pelican": "bulbous cargo-belly hull for bombs", "crane": "tall crane arms and cargo cradles",
    "heron": "long command boom with antenna masts", "harrier": "gun cradle under a patched hull",
    "thunderbird": "wide hull with heavy cannon blisters", "defiance": "armoured frigate with bolted-on turrets",
    "liberty": "cruiser with bolted gun blisters",
    "blade": "blade-like swept hull with serrated edges", "cutlass": "curved cutlass-shaped hull",
    "saber": "long curved sabre blades", "scimitar": "curved scimitar-shaped hull", "talon": "hooked talon prongs",
    "venom": "needle fangs and green glowing vents", "shadow": "low dark hull with hidden lights",
    "specter": "flat ghostly hull with a veil shimmer", "phantom": "flat ghostly hull with a veil shimmer",
    "reaver": "ram prow with welded cannons", "marauder": "heavy scavenged hull with jagged armour spikes",
    "ravager": "ramshackle war galley with boom arms and cannons", "galleon": "tiered stolen hull sections with a ram prow",
    "acolyte": "small hull with crystal resonator wings", "avatar": "tall winged hull with a halo ring",
    "crusader": "pointed shield-shaped hull with crystal spires", "divine": "enormous cathedral-like hull with a crystal halo",
    "glory": "radiant fan of crystal spires", "herald": "long slender blade hull with a crystal prow",
    "inquisitor": "narrow hull with crystal lens arms", "oracle": "floating crystal sphere with orbiting resonator rings",
    "paladin": "shield-shaped hull with crystal wings", "prophet": "tall crystal spire with curved wing arcs",
    "purifier": "wide hull with crystal ordnance cradles", "seraph": "layered curved wings around a crystal core",
    "smiter": "heavy hull with a forward crystal lance", "templar": "heavy armoured hull with curved crystal spires",
    "virtue": "slender arcs around a glowing crystal", "wrath": "hull with forward-curved crystal blades",
    "bomber": "bomb racks", "drone": "single sensor eye",
}


def load_roster() -> list:
    """Read every ship (id, name, faction, role) from ShipDefinitions.ts, in file order."""
    text = SHIP_DEFINITIONS.read_text(encoding="utf-8")
    return [Ship(*match) for match in SHIP_PATTERN.findall(text)]


def motif_for(ship: Ship) -> str:
    """Short visual phrase for a ship: override, else the first matching words of its name and id."""
    if ship.ship_id in OVERRIDES:
        return OVERRIDES[ship.ship_id]
    words = re.split(r"[\s_\-]+", f"{ship.name} {ship.ship_id}".lower())
    found = [WORD_MOTIFS[w] for w in dict.fromkeys(words) if w in WORD_MOTIFS]
    return ", ".join(found[:MAX_MOTIFS]) or GENERIC_MOTIF
