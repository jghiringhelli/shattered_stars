/**
 * Ship Definitions
 * Complete stat blocks for all ships in the game
 */

import type {
  ShipDefinition,
  ManeuverDefinition,
  ManeuverDifficulty,
  ManeuverDirection,
} from "../core/types";
import type { FactionId } from "../config";

// ============================================
// Maneuver Dial Templates
// ============================================

/** Standard fighter dial - balanced mobility */
const FIGHTER_DIAL: ManeuverDefinition[] = [
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "white" },
  { direction: "bank_right", speed: 1, difficulty: "white" },
  { direction: "turn_left", speed: 1, difficulty: "white" },
  { direction: "turn_right", speed: 1, difficulty: "white" },
  // Speed 2
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  { direction: "turn_left", speed: 2, difficulty: "white" },
  { direction: "turn_right", speed: 2, difficulty: "white" },
  // Speed 3
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 3, difficulty: "red" },
  { direction: "bank_right", speed: 3, difficulty: "red" },
  // Speed 4
  { direction: "straight", speed: 4, difficulty: "white" },
  // K-turn
  { direction: "kturn", speed: 3, difficulty: "red" },
];

/** Interceptor dial - very agile */
const INTERCEPTOR_DIAL: ManeuverDefinition[] = [
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "green" },
  { direction: "bank_right", speed: 1, difficulty: "green" },
  { direction: "turn_left", speed: 1, difficulty: "white" },
  { direction: "turn_right", speed: 1, difficulty: "white" },
  // Speed 2
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "green" },
  { direction: "bank_right", speed: 2, difficulty: "green" },
  { direction: "turn_left", speed: 2, difficulty: "white" },
  { direction: "turn_right", speed: 2, difficulty: "white" },
  // Speed 3
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 3, difficulty: "white" },
  { direction: "bank_right", speed: 3, difficulty: "white" },
  { direction: "turn_left", speed: 3, difficulty: "red" },
  { direction: "turn_right", speed: 3, difficulty: "red" },
  // Speed 4-5
  { direction: "straight", speed: 4, difficulty: "white" },
  { direction: "straight", speed: 5, difficulty: "red" },
  // Special
  { direction: "kturn", speed: 2, difficulty: "red" },
  { direction: "kturn", speed: 4, difficulty: "red" },
  { direction: "tallon_left", speed: 3, difficulty: "red" },
  { direction: "tallon_right", speed: 3, difficulty: "red" },
];

/** Bomber dial - slow but steady */
const BOMBER_DIAL: ManeuverDefinition[] = [
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "green" },
  { direction: "bank_right", speed: 1, difficulty: "green" },
  { direction: "turn_left", speed: 1, difficulty: "white" },
  { direction: "turn_right", speed: 1, difficulty: "white" },
  // Speed 2
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  { direction: "turn_left", speed: 2, difficulty: "red" },
  { direction: "turn_right", speed: 2, difficulty: "red" },
  // Speed 3
  { direction: "straight", speed: 3, difficulty: "white" },
  // K-turn
  { direction: "kturn", speed: 2, difficulty: "red" },
];

/**
 * Light fighter dial — Z-95 tier. Between fighter and interceptor.
 * Agile at low speed (green banks speed 1), white turns 1–2, tops out at speed 5.
 * K-turn available but always red. No tallon/segnor — these aren't ace ships.
 */
const LIGHT_FIGHTER_DIAL: ManeuverDefinition[] = [
  // Speed 1 — nimble in a dogfight
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "green" },
  { direction: "bank_right", speed: 1, difficulty: "green" },
  { direction: "turn_left", speed: 1, difficulty: "white" },
  { direction: "turn_right", speed: 1, difficulty: "white" },
  // Speed 2 — still manageable
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  { direction: "turn_left", speed: 2, difficulty: "white" },
  { direction: "turn_right", speed: 2, difficulty: "white" },
  // Speed 3 — banks start to bite
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 3, difficulty: "red" },
  { direction: "bank_right", speed: 3, difficulty: "red" },
  // Speed 4–5 — straightaways only
  { direction: "straight", speed: 4, difficulty: "white" },
  { direction: "straight", speed: 5, difficulty: "red" },
  // K-turn available but always costly
  { direction: "kturn", speed: 3, difficulty: "red" },
];

/** Capital ship dial - minimal mobility */
export const CAPITAL_DIAL: ManeuverDefinition[] = [
  // Speed 0 (stationary)
  { direction: "straight", speed: 0, difficulty: "white" },
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "white" },
  { direction: "bank_right", speed: 1, difficulty: "white" },
  // Speed 2
  { direction: "straight", speed: 2, difficulty: "white" },
  { direction: "bank_left", speed: 2, difficulty: "red" },
  { direction: "bank_right", speed: 2, difficulty: "red" },
];

/**
 * Gunship dial — heavy brawler (Y-Wing / assault gunship tier).
 * Tougher than a bomber at close range; the K-turn is expensive but available.
 */
const GUNSHIP_DIAL: ManeuverDefinition[] = [
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "white" },
  { direction: "bank_right", speed: 1, difficulty: "white" },
  { direction: "turn_left", speed: 1, difficulty: "red" },
  { direction: "turn_right", speed: 1, difficulty: "red" },
  // Speed 2
  { direction: "straight", speed: 2, difficulty: "white" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  { direction: "turn_left", speed: 2, difficulty: "red" },
  { direction: "turn_right", speed: 2, difficulty: "red" },
  // Speed 3
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 3, difficulty: "red" },
  { direction: "bank_right", speed: 3, difficulty: "red" },
  // K-turn (heavy — red, and only at speed 2)
  { direction: "kturn", speed: 2, difficulty: "red" },
];

/**
 * Support dial — command/utility vessel (HWK-290 / Lambda shuttle tier).
 * Slower and less stressful than a bomber; no K-turn — these aren't combat pilots.
 */
const SUPPORT_DIAL: ManeuverDefinition[] = [
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "white" },
  { direction: "bank_right", speed: 1, difficulty: "white" },
  { direction: "turn_left", speed: 1, difficulty: "red" },
  { direction: "turn_right", speed: 1, difficulty: "red" },
  // Speed 2
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  // Speed 3
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 3, difficulty: "red" },
  { direction: "bank_right", speed: 3, difficulty: "red" },
  // No K-turn — support ships don't flip
];

// ============================================
// Unique "Odd Duck" Dials — one per faction
// ============================================

/**
 * TERRAN HARBINGER — "Defender-class" command support.
 * Inspired by: TIE Defender. Military-drilled support pilots can execute a
 * white K-turn — something no other support ship in the galaxy can do.
 * Speed 1–4; green banks at low speed; red only at top speed.
 */
const HARBINGER_DIAL: ManeuverDefinition[] = [
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "green" },
  { direction: "bank_right", speed: 1, difficulty: "green" },
  { direction: "turn_left", speed: 1, difficulty: "white" },
  { direction: "turn_right", speed: 1, difficulty: "white" },
  // Speed 2
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  // WHITE K-turn — the Harbinger's signature. Terran pilots train obsessively.
  { direction: "kturn", speed: 2, difficulty: "white" },
  // Speed 3
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 3, difficulty: "white" },
  { direction: "bank_right", speed: 3, difficulty: "white" },
  // Speed 4 — pushing it
  { direction: "straight", speed: 4, difficulty: "red" },
];

/**
 * CONFED ALBATROSS — modified freighter repurposed as a heavy gunship.
 * Inspired by: YT-2400 / Millennium Falcon. Can punch the hyperdrive on the
 * straightaways (speed 0–4) and is surprisingly agile in banks, but the hull
 * is too wide for proper turns. No K-turn — you don't flip a freighter.
 */
const ALBATROSS_DIAL: ManeuverDefinition[] = [
  // Speed 0 — drift/hover (unexpected trick)
  { direction: "straight", speed: 0, difficulty: "white" },
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "white" },
  { direction: "bank_right", speed: 1, difficulty: "white" },
  // Speed 2
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  // Speed 3 — freighter can haul fast, banks get red
  { direction: "straight", speed: 3, difficulty: "green" },
  { direction: "bank_left", speed: 3, difficulty: "red" },
  { direction: "bank_right", speed: 3, difficulty: "red" },
  // Speed 4 — full burn, straight only
  { direction: "straight", speed: 4, difficulty: "red" },
  // No turns at all — too wide. No K-turn — you don't flip a freighter.
];

/**
 * SYNTH HUNTER (IG-88 chassis: hunter / stalker / ravager) — machine precision.
 * Inspired by: IG-2000. Synthetics have no organic pilot fatigue; they bank
 * green well into speed 3 and can execute segnor loops and a white K-turn.
 * All three units share this chassis — the foundation for future ability synergy
 * (e.g., "while another Hunter-chassis unit is alive, gain +1 agility").
 */
const HUNTER_DIAL: ManeuverDefinition[] = [
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "green" },
  { direction: "bank_right", speed: 1, difficulty: "green" },
  { direction: "turn_left", speed: 1, difficulty: "white" },
  { direction: "turn_right", speed: 1, difficulty: "white" },
  // Speed 2 — segnor loops: precision curved approach
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "green" },
  { direction: "bank_right", speed: 2, difficulty: "green" },
  { direction: "segnor_left", speed: 2, difficulty: "white" },
  { direction: "segnor_right", speed: 2, difficulty: "white" },
  // Speed 3 — WHITE K-turn (reorientation subroutine)
  { direction: "straight", speed: 3, difficulty: "green" },
  { direction: "bank_left", speed: 3, difficulty: "white" },
  { direction: "bank_right", speed: 3, difficulty: "white" },
  { direction: "segnor_left", speed: 3, difficulty: "white" },
  { direction: "segnor_right", speed: 3, difficulty: "white" },
  { direction: "kturn", speed: 3, difficulty: "white" },
  // Speed 4-5 — full burn; thermal limits kick in at 5
  { direction: "straight", speed: 4, difficulty: "white" },
  { direction: "straight", speed: 5, difficulty: "red" },
];

/**
 * CORSAIR TORPEDO BOAT — pirate-taught Jumpmaster equivalent.
 * Inspired by: Jumpmaster 5000. Pirates who learned wild flying from necessity.
 * White K-turn at speed 2 is the signature trick; segnor loops for bait-and-switch.
 */
const TORPEDO_BOAT_DIAL: ManeuverDefinition[] = [
  // Speed 1
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "green" },
  { direction: "bank_right", speed: 1, difficulty: "green" },
  { direction: "turn_left", speed: 1, difficulty: "white" },
  { direction: "turn_right", speed: 1, difficulty: "white" },
  { direction: "segnor_left", speed: 1, difficulty: "white" },
  { direction: "segnor_right", speed: 1, difficulty: "white" },
  // Speed 2 — WHITE K-turn. The Jumpmaster's trick. Pirates figured it out.
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  { direction: "segnor_left", speed: 2, difficulty: "white" },
  { direction: "segnor_right", speed: 2, difficulty: "white" },
  { direction: "kturn", speed: 2, difficulty: "white" },
  // Speed 3 — pirates keep the banks white where a Javelin's go red
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 3, difficulty: "white" },
  { direction: "bank_right", speed: 3, difficulty: "white" },
  // Speed 4 — hotrod territory
  { direction: "straight", speed: 4, difficulty: "red" },
];

/**
 * ASCENDANT AVATAR — divine heavy gunship.
 * Inspired by: Aggressor assault fighter. A ponderous sacred vessel that moves
 * with deliberate, almost ceremonial precision. White K-turn at speed 2 ("the
 * Blessed Reversal") and segnor loops at speed 1 ("divine curved approach").
 */
const AVATAR_DIAL: ManeuverDefinition[] = [
  // Speed 1 — deliberate; green banks, segnors are white (blessed)
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "green" },
  { direction: "bank_right", speed: 1, difficulty: "green" },
  { direction: "turn_left", speed: 1, difficulty: "red" },
  { direction: "turn_right", speed: 1, difficulty: "red" },
  { direction: "segnor_left", speed: 1, difficulty: "white" },
  { direction: "segnor_right", speed: 1, difficulty: "white" },
  // Speed 2 — WHITE K-turn (the Blessed Reversal)
  { direction: "straight", speed: 2, difficulty: "white" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  { direction: "kturn", speed: 2, difficulty: "white" },
  // Speed 3 — pushing the sacred hull
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 3, difficulty: "red" },
  { direction: "bank_right", speed: 3, difficulty: "red" },
];

// ============================================
// Variant Dials — a base dial with 1–2 maneuvers retuned
// ============================================

/** One retuned maneuver; banks and turns change on both sides together. */
interface DialTweak {
  readonly maneuver: "straight" | "bank" | "turn";
  readonly speed: number;
  readonly difficulty: ManeuverDifficulty;
}

/**
 * Clone a dial with a few maneuvers retuned (added when the base lacks them).
 * Same-chassis variants differ here: the dial drives real-time stress.
 *
 * @param base - The dial to start from (left untouched).
 * @param tweaks - Maneuvers to set; banks/turns apply to left and right.
 * @returns A new dial.
 */
function tuneDial(
  base: readonly ManeuverDefinition[],
  tweaks: readonly DialTweak[],
): ManeuverDefinition[] {
  const dial = [...base];
  for (const { maneuver, speed, difficulty } of tweaks) {
    const directions: readonly ManeuverDirection[] =
      maneuver === "straight"
        ? ["straight"]
        : [`${maneuver}_left`, `${maneuver}_right`];
    for (const direction of directions) {
      const index = dial.findIndex(
        (m) => m.direction === direction && m.speed === speed,
      );
      const entry = { direction, speed, difficulty };
      if (index >= 0) dial[index] = entry;
      else dial.push(entry);
    }
  }
  return dial;
}

/** Confed Kestrel — light-shielded dogfighter: green hard turn at speed 1. */
const KESTREL_DIAL = tuneDial(INTERCEPTOR_DIAL, [
  { maneuver: "turn", speed: 1, difficulty: "green" },
]);

/** Corsair raider interceptors (Talon, Fang, Phantom) — white banks at speed 4. */
const RAIDER_DIAL = tuneDial(INTERCEPTOR_DIAL, [
  { maneuver: "bank", speed: 4, difficulty: "white" },
]);

/** Ascendant Virtue — zealot picket: green banks at speed 3. */
const VIRTUE_DIAL = tuneDial(INTERCEPTOR_DIAL, [
  { maneuver: "bank", speed: 3, difficulty: "green" },
]);

/** Synth Interceptor Drone — no pilot to black out: white hard turn at speed 3. */
const SWARM_INTERCEPTOR_DIAL = tuneDial(INTERCEPTOR_DIAL, [
  { maneuver: "turn", speed: 3, difficulty: "white" },
]);

/** Corsair Venom — hot-rodded light fighter: white banks at speed 3. */
const VENOM_DIAL = tuneDial(LIGHT_FIGHTER_DIAL, [
  { maneuver: "bank", speed: 3, difficulty: "white" },
]);

/** Ascendant Cherub — serene initiate: green banks at speed 2. */
const CHERUB_DIAL = tuneDial(LIGHT_FIGHTER_DIAL, [
  { maneuver: "bank", speed: 2, difficulty: "green" },
]);

/** Confed Finch — loitering scout: green turn at 1, green banks at 2. */
const FINCH_DIAL = tuneDial(LIGHT_FIGHTER_DIAL, [
  { maneuver: "turn", speed: 1, difficulty: "green" },
  { maneuver: "bank", speed: 2, difficulty: "green" },
]);

/** Synth light drones — machine precision: green hard turn at speed 2. */
const DRONE_DIAL = tuneDial(LIGHT_FIGHTER_DIAL, [
  { maneuver: "turn", speed: 2, difficulty: "green" },
]);

/** Ascendant Templar — temple guard: green banks at speed 1. */
const TEMPLAR_DIAL = tuneDial(FIGHTER_DIAL, [
  { maneuver: "bank", speed: 1, difficulty: "green" },
]);

/** Confed Hawk — brawler that turns inside you: green hard turn at speed 1. */
const HAWK_DIAL = tuneDial(FIGHTER_DIAL, [
  { maneuver: "turn", speed: 1, difficulty: "green" },
]);

/** Corsair Cutlass — boarding fighter: white banks at speed 3. */
const CUTLASS_DIAL = tuneDial(FIGHTER_DIAL, [
  { maneuver: "bank", speed: 3, difficulty: "white" },
]);

/** Ascendant Oracle — foresighted command ship: green banks at speed 1. */
const ORACLE_DIAL = tuneDial(SUPPORT_DIAL, [
  { maneuver: "bank", speed: 1, difficulty: "green" },
]);

/** Terran Stiletto — Z-95 tier: runs flat out (white straight at speed 5). */
const STILETTO_DIAL = tuneDial(LIGHT_FIGHTER_DIAL, [
  { maneuver: "straight", speed: 5, difficulty: "white" },
]);

/** Terran Viper — pursuit interceptor: white straight at speed 5. */
const VIPER_DIAL = tuneDial(INTERCEPTOR_DIAL, [
  { maneuver: "straight", speed: 5, difficulty: "white" },
]);

/** Terran Centurion — drilled line fighter: white banks at speed 3. */
const CENTURION_DIAL = tuneDial(FIGHTER_DIAL, [
  { maneuver: "bank", speed: 3, difficulty: "white" },
]);

/** Terran Vindicator — gunship with a steady helm: white banks at speed 3. */
const VINDICATOR_DIAL = tuneDial(GUNSHIP_DIAL, [
  { maneuver: "bank", speed: 3, difficulty: "white" },
]);

/** Confed Pelican — forgiving bomber: green banks at speed 2. */
const PELICAN_DIAL = tuneDial(BOMBER_DIAL, [
  { maneuver: "bank", speed: 2, difficulty: "green" },
]);

/** Ascendant Acolyte — devout tender: white hard turn at speed 1. */
const ACOLYTE_DIAL = tuneDial(SUPPORT_DIAL, [
  { maneuver: "turn", speed: 1, difficulty: "white" },
]);

/** Ascendant Glory — processional capital: white banks at speed 2. */
const GLORY_DIAL = tuneDial(CAPITAL_DIAL, [
  { maneuver: "bank", speed: 2, difficulty: "white" },
]);

/**
 * Terran Javelin — the fast bomber (top speed 4): the bomber dial plus a
 * white speed-4 straight, so its top speed is a real (unstressed) option
 * instead of a missing — red — cell.
 */
const JAVELIN_DIAL = tuneDial(BOMBER_DIAL, [
  { maneuver: "straight", speed: 4, difficulty: "white" },
]);

/**
 * A dial as a ship can fly it: the maneuvers above its top speed are cut
 * (shared base dials print rows some hulls cannot reach). The same array
 * comes back when nothing is cut.
 *
 * @param dial - The authored dial.
 * @param topSpeed - The ship's top speed.
 * @returns The reachable dial.
 */
function withinTopSpeed(
  dial: readonly ManeuverDefinition[],
  topSpeed: number,
): readonly ManeuverDefinition[] {
  return dial.some((m) => m.speed > topSpeed)
    ? dial.filter((m) => m.speed <= topSpeed)
    : dial;
}

// ============================================
// Ship Definitions by Faction
// ============================================

export const SHIP_DEFINITIONS: Record<string, ShipDefinition> = {
  // ==========================================
  // TERRAN HEGEMONY (20 ships)
  // Theme: Military discipline, formation fighting, balanced stats
  // ==========================================

  // Light Fighters (3)
  terran_viper: {
    id: "terran_viper",
    name: "Viper-class Interceptor",
    faction: "terran_hegemony",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 2,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "target_lock", "barrel_roll", "boost"],
      pointCost: 43,
    },
    spriteKey: "ship_terran_viper",
    description: "Fast interceptor designed for fleet defense and pursuit.",
  },
  terran_stiletto: {
    id: "terran_stiletto",
    name: "Stiletto Light Fighter",
    faction: "terran_hegemony",
    role: "light_fighter",
    baseStats: {
      hull: 2,
      shields: 2,
      attack: 2,
      agility: 4,
      speed: { min: 1, max: 5 },
      size: "tiny",
      actions: ["focus", "evade", "barrel_roll"],
      pointCost: 37,
    },
    spriteKey: "ship_terran_stiletto",
    description: "Mass-produced patrol fighter for system defense.",
  },
  terran_raptor: {
    id: "terran_raptor",
    name: "Raptor Strike Fighter",
    faction: "terran_hegemony",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 3,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "target_lock", "barrel_roll", "boost"],
      pointCost: 43,
    },
    spriteKey: "ship_terran_raptor",
    description: "Elite interceptor for ace pilots.",
  },

  // Heavy Fighters (4)
  terran_gladius: {
    id: "terran_gladius",
    name: "Gladius-class Fighter",
    faction: "terran_hegemony",
    role: "heavy_fighter",
    baseStats: {
      hull: 4,
      shields: 2,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "barrel_roll"],
      pointCost: 45,
    },
    spriteKey: "ship_terran_gladius",
    description: "Workhorse fighter of the Hegemony fleet.",
  },
  terran_centurion: {
    id: "terran_centurion",
    name: "Centurion Heavy Fighter",
    faction: "terran_hegemony",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 3,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 58,
    },
    spriteKey: "ship_terran_centurion",
    description: "Heavily armored fighter for breakthrough assaults.",
  },
  terran_praetorian: {
    id: "terran_praetorian",
    name: "Praetorian Guard Fighter",
    faction: "terran_hegemony",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 4,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "reinforce", "coordinate"],
      pointCost: 59,
    },
    spriteKey: "ship_terran_praetorian",
    description: "Elite guard fighter assigned to flag officers.",
  },
  terran_legionnaire: {
    id: "terran_legionnaire",
    name: "Legionnaire Fighter",
    faction: "terran_hegemony",
    role: "heavy_fighter",
    baseStats: {
      hull: 4,
      shields: 3,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "barrel_roll"],
      pointCost: 53,
    },
    spriteKey: "ship_terran_legionnaire",
    description: "Standard line fighter for fleet engagements.",
  },

  // Bombers (3)
  terran_hammer: {
    id: "terran_hammer",
    name: "Hammer-class Bomber",
    faction: "terran_hegemony",
    role: "bomber",
    baseStats: {
      hull: 5,
      shields: 3,
      attack: 3,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "reload"],
      pointCost: 53,
    },
    spriteKey: "ship_terran_hammer",
    description: "Heavy bomber capable of devastating strike runs.",
  },
  terran_thunderbolt: {
    id: "terran_thunderbolt",
    name: "Thunderbolt Assault Bomber",
    faction: "terran_hegemony",
    role: "bomber",
    baseStats: {
      hull: 6,
      shields: 4,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "reload", "reinforce"],
      pointCost: 68,
    },
    spriteKey: "ship_terran_thunderbolt",
    description: "Heavy assault bomber for capital ship strikes.",
  },
  terran_javelin: {
    id: "terran_javelin",
    name: "Javelin Torpedo Bomber",
    faction: "terran_hegemony",
    role: "bomber",
    baseStats: {
      hull: 4,
      shields: 2,
      attack: 2,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "barrel_roll"],
      pointCost: 42,
    },
    spriteKey: "ship_terran_javelin",
    description: "Fast torpedo bomber for hit-and-run strikes.",
  },

  // Support Ships (3)
  terran_sentinel: {
    id: "terran_sentinel",
    name: "Sentinel-class Support",
    faction: "terran_hegemony",
    role: "support",
    baseStats: {
      hull: 6,
      shields: 4,
      attack: 2,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "coordinate", "reinforce", "jam"],
      pointCost: 68,
    },
    spriteKey: "ship_terran_sentinel",
    description: "Armoured command ship providing fleet coordination.",
  },
  terran_guardian: {
    id: "terran_guardian",
    name: "Guardian ECM Ship",
    faction: "terran_hegemony",
    role: "support",
    baseStats: {
      hull: 4,
      shields: 5,
      attack: 1,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "jam", "reinforce", "coordinate"],
      pointCost: 61,
    },
    spriteKey: "ship_terran_guardian",
    description: "Electronic warfare platform for fleet defense.",
  },
  terran_harbinger: {
    id: "terran_harbinger",
    name: "Harbinger Recon Ship",
    faction: "terran_hegemony",
    role: "support",
    baseStats: {
      hull: 3,
      shields: 3,
      attack: 2,
      agility: 3,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "evade", "target_lock", "coordinate"],
      pointCost: 53,
    },
    spriteKey: "ship_terran_harbinger",
    description: "Fast reconnaissance and target acquisition ship.",
  },

  // Gunships (3)
  terran_bastion: {
    id: "terran_bastion",
    name: "Bastion Assault Gunship",
    faction: "terran_hegemony",
    role: "gunship",
    baseStats: {
      hull: 7,
      shields: 4,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "rotate_arc", "reinforce"],
      pointCost: 95,
    },
    spriteKey: "ship_terran_bastion",
    description: "Heavy gunship with devastating forward firepower.",
  },
  terran_bulwark: {
    id: "terran_bulwark",
    name: "Bulwark Defense Platform",
    faction: "terran_hegemony",
    role: "gunship",
    baseStats: {
      hull: 8,
      shields: 5,
      attack: 3,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "large",
      actions: ["focus", "target_lock", "reinforce", "rotate_arc"],
      pointCost: 91,
    },
    spriteKey: "ship_terran_bulwark",
    description: "Mobile defense platform for area denial.",
  },
  terran_vindicator: {
    id: "terran_vindicator",
    name: "Vindicator Strike Cruiser",
    faction: "terran_hegemony",
    role: "gunship",
    baseStats: {
      hull: 6,
      shields: 4,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "coordinate", "rotate_arc"],
      pointCost: 90,
    },
    spriteKey: "ship_terran_vindicator",
    description: "Multi-role strike cruiser for independent operations.",
  },

  // Capital Ships (4)
  terran_imperator: {
    id: "terran_imperator",
    name: "Imperator Battlecruiser",
    faction: "terran_hegemony",
    role: "capital",
    baseStats: {
      hull: 36,
      shields: 24,
      armor: 1,
      attack: 5,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "huge",
      actions: ["focus", "target_lock", "reinforce", "coordinate"],
      pointCost: 118,
    },
    spriteKey: "ship_terran_imperator",
    description: "Flagship of the Hegemony battle fleet.",
  },
  terran_dominator: {
    id: "terran_dominator",
    name: "Dominator Carrier",
    faction: "terran_hegemony",
    role: "capital",
    baseStats: {
      hull: 30,
      shields: 18,
      armor: 1,
      attack: 3,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "huge",
      actions: ["focus", "coordinate", "reinforce", "jam"],
      pointCost: 93,
    },
    spriteKey: "ship_terran_dominator",
    description: "Fleet carrier capable of deploying fighter wings.",
  },
  terran_executor: {
    id: "terran_executor",
    name: "Executor Destroyer",
    faction: "terran_hegemony",
    role: "capital",
    baseStats: {
      hull: 27,
      shields: 15,
      armor: 1,
      attack: 4,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "large",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 83,
    },
    spriteKey: "ship_terran_executor",
    description: "Fast destroyer for fleet screening operations.",
  },
  terran_consul: {
    id: "terran_consul",
    name: "Consul Command Ship",
    faction: "terran_hegemony",
    role: "capital",
    baseStats: {
      hull: 24,
      shields: 21,
      armor: 1,
      attack: 2,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "large",
      actions: ["focus", "coordinate", "reinforce", "jam"],
      pointCost: 78,
    },
    spriteKey: "ship_terran_consul",
    description: "Dedicated command and control vessel.",
  },

  // ==========================================
  // FREE CONFEDERATION (20 ships)
  // Theme: Versatility, rebellion, mixed tech, guerrilla warfare
  // ==========================================

  // Light Fighters (4)
  confed_sparrow: {
    id: "confed_sparrow",
    name: "Sparrow Light Fighter",
    faction: "free_confederation",
    role: "light_fighter",
    baseStats: {
      hull: 3,
      shields: 2,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "tiny",
      actions: ["focus", "evade", "barrel_roll", "boost"],
      pointCost: 35,
    },
    spriteKey: "ship_confed_sparrow",
    description: "Cheap, nimble fighter used in swarm tactics.",
  },
  confed_wasp: {
    id: "confed_wasp",
    name: "Wasp Interceptor",
    faction: "free_confederation",
    role: "light_fighter",
    baseStats: {
      hull: 2,
      shields: 1,
      attack: 2,
      agility: 4,
      speed: { min: 1, max: 5 },
      size: "tiny",
      actions: ["focus", "evade", "barrel_roll", "boost"],
      pointCost: 26,
    },
    spriteKey: "ship_confed_wasp",
    description:
      "Ultra-light hit-and-run fighter: dodges well, shrugs off little.",
  },
  confed_finch: {
    id: "confed_finch",
    name: "Finch Scout",
    faction: "free_confederation",
    role: "light_fighter",
    baseStats: {
      hull: 2,
      shields: 2,
      attack: 1,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "tiny",
      actions: ["focus", "evade", "barrel_roll", "boost", "coordinate"],
      pointCost: 28,
    },
    spriteKey: "ship_confed_finch",
    description:
      "Reconnaissance spotter with a sensor suite: loiters, does not dogfight.",
  },
  confed_kestrel: {
    id: "confed_kestrel",
    name: "Kestrel Strike Fighter",
    faction: "free_confederation",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 1,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "target_lock", "barrel_roll", "boost"],
      pointCost: 35,
    },
    spriteKey: "ship_confed_kestrel",
    description:
      "Light-shielded dogfighter that turns inside anything at low speed.",
  },

  // Heavy Fighters (4)
  confed_falcon: {
    id: "confed_falcon",
    name: "Falcon Strike Fighter",
    faction: "free_confederation",
    role: "heavy_fighter",
    baseStats: {
      hull: 4,
      shields: 3,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "evade", "target_lock", "barrel_roll"],
      pointCost: 53,
    },
    spriteKey: "ship_confed_falcon",
    description: "Versatile fighter favored by mercenaries.",
  },
  confed_hawk: {
    id: "confed_hawk",
    name: "Hawk Assault Fighter",
    faction: "free_confederation",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 2,
      attack: 4,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "barrel_roll"],
      // Top of its pricing tolerance (expected 50 ± 3): the hull played like
      // +17 % more points than its price after the bots stopped weaving.
      pointCost: 53,
    },
    spriteKey: "ship_confed_hawk",
    description:
      "Heavy assault fighter that turns inside its target at low speed.",
  },
  confed_eagle: {
    id: "confed_eagle",
    name: "Eagle Multi-role Fighter",
    faction: "free_confederation",
    role: "heavy_fighter",
    baseStats: {
      hull: 4,
      shields: 3,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "evade", "target_lock", "coordinate"],
      pointCost: 53,
    },
    spriteKey: "ship_confed_eagle",
    description: "Multi-role fighter adaptable to any mission.",
  },
  confed_condor: {
    id: "confed_condor",
    name: "Condor Heavy Fighter",
    faction: "free_confederation",
    role: "heavy_fighter",
    baseStats: {
      hull: 6,
      shields: 2,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 58,
    },
    spriteKey: "ship_confed_condor",
    description:
      "Durable brawler for sustained engagements: armour plating over shields.",
  },

  // Stealth Ships (2)
  confed_raven: {
    id: "confed_raven",
    name: "Raven Stealth Fighter",
    faction: "free_confederation",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 3,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "cloak", "barrel_roll"],
      pointCost: 43,
    },
    spriteKey: "ship_confed_raven",
    description:
      "Stealth-capable fighter for ambush tactics, with a reinforced shield grid.",
  },
  confed_owl: {
    id: "confed_owl",
    name: "Owl Night Fighter",
    faction: "free_confederation",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 3,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "barrel_roll", "cloak", "jam"],
      pointCost: 43,
    },
    spriteKey: "ship_confed_owl",
    description: "Electronic warfare stealth fighter.",
  },

  // Bombers (2)
  confed_pelican: {
    id: "confed_pelican",
    name: "Pelican Bomber",
    faction: "free_confederation",
    role: "bomber",
    baseStats: {
      hull: 5,
      shields: 3,
      attack: 2,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "reload"],
      pointCost: 53,
    },
    spriteKey: "ship_confed_pelican",
    description: "Standard bomber for ground and ship attacks.",
  },
  confed_albatross: {
    id: "confed_albatross",
    name: "Albatross Heavy Bomber",
    faction: "free_confederation",
    role: "bomber",
    baseStats: {
      hull: 7,
      shields: 4,
      attack: 4,
      agility: 1,
      speed: { min: 0, max: 4 },
      size: "large",
      actions: ["focus", "target_lock", "reload", "reinforce"],
      pointCost: 66,
    },
    spriteKey: "ship_confed_albatross",
    description: "Long-range heavy bomber.",
  },

  // Gunships (3)
  confed_phoenix: {
    id: "confed_phoenix",
    name: "Phoenix Gunship",
    faction: "free_confederation",
    role: "gunship",
    baseStats: {
      hull: 6,
      shields: 3,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "rotate_arc", "reinforce"],
      pointCost: 90,
    },
    spriteKey: "ship_confed_phoenix",
    description: "Heavy gunship with rotating turret weapons.",
  },
  confed_thunderbird: {
    id: "confed_thunderbird",
    name: "Thunderbird Assault Ship",
    faction: "free_confederation",
    role: "gunship",
    baseStats: {
      hull: 7,
      shields: 4,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "large",
      actions: ["focus", "target_lock", "rotate_arc", "coordinate"],
      pointCost: 87,
    },
    spriteKey: "ship_confed_thunderbird",
    description: "Command gunship for squadron leaders.",
  },
  confed_harrier: {
    id: "confed_harrier",
    name: "Harrier Support Gunship",
    faction: "free_confederation",
    role: "gunship",
    baseStats: {
      hull: 5,
      shields: 3,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "coordinate", "reinforce"],
      pointCost: 73,
    },
    spriteKey: "ship_confed_harrier",
    description: "Fast gunship for escort duties.",
  },

  // Support Ships (2)
  confed_crane: {
    id: "confed_crane",
    name: "Crane Support Vessel",
    faction: "free_confederation",
    role: "support",
    baseStats: {
      hull: 4,
      shields: 4,
      attack: 1,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "coordinate", "reinforce", "jam"],
      pointCost: 53,
    },
    spriteKey: "ship_confed_crane",
    description: "Dedicated support and repair vessel.",
  },
  confed_heron: {
    id: "confed_heron",
    name: "Heron Command Ship",
    faction: "free_confederation",
    role: "support",
    baseStats: {
      hull: 5,
      shields: 5,
      attack: 2,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "large",
      actions: ["focus", "coordinate", "reinforce", "jam"],
      pointCost: 72,
    },
    spriteKey: "ship_confed_heron",
    description: "Mobile command post for rebel operations.",
  },

  // Capital Ships (3)
  confed_liberty: {
    id: "confed_liberty",
    name: "Liberty Cruiser",
    faction: "free_confederation",
    role: "capital",
    baseStats: {
      hull: 33,
      shields: 15,
      armor: 1,
      attack: 3,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "huge",
      actions: ["focus", "target_lock", "coordinate", "reinforce"],
      pointCost: 94,
    },
    spriteKey: "ship_confed_liberty",
    description:
      "Rebel flagship converted from a freighter: thick hull, thin shields.",
  },
  confed_independence: {
    id: "confed_independence",
    name: "Independence Carrier",
    faction: "free_confederation",
    role: "capital",
    baseStats: {
      hull: 27,
      shields: 15,
      armor: 1,
      attack: 2,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "huge",
      actions: ["focus", "coordinate", "reinforce"],
      pointCost: 77,
    },
    spriteKey: "ship_confed_independence",
    description: "Converted cargo hauler serving as a light carrier.",
  },
  confed_defiance: {
    id: "confed_defiance",
    name: "Defiance Assault Frigate",
    faction: "free_confederation",
    role: "capital",
    baseStats: {
      hull: 24,
      shields: 12,
      armor: 1,
      attack: 4,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "large",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 75,
    },
    spriteKey: "ship_confed_defiance",
    description: "Fast frigate for raiding operations.",
  },

  // ==========================================
  // SYNTHETIC COLLECTIVE (20 ships)
  // Theme: Networked AI, swarms, precise targeting, adaptation
  // ==========================================

  // Drones (5)
  synth_drone: {
    id: "synth_drone",
    name: "Combat Drone",
    faction: "synthetic_collective",
    role: "light_fighter",
    baseStats: {
      hull: 3,
      shields: 2,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 4 },
      size: "tiny",
      actions: ["calculate", "evade", "barrel_roll"],
      pointCost: 34,
    },
    spriteKey: "ship_synth_drone",
    description:
      "Expendable Collective drone: slow, but turns with machine precision.",
  },
  synth_scout_drone: {
    id: "synth_scout_drone",
    name: "Scout Drone",
    faction: "synthetic_collective",
    role: "light_fighter",
    baseStats: {
      hull: 1,
      shields: 1,
      attack: 2,
      agility: 4,
      speed: { min: 1, max: 5 },
      size: "tiny",
      actions: ["calculate", "evade", "barrel_roll", "boost"],
      pointCost: 26,
    },
    spriteKey: "ship_synth_scout_drone",
    description: "Disposable reconnaissance drone with machine-precise turns.",
  },
  synth_heavy_drone: {
    id: "synth_heavy_drone",
    name: "Heavy Combat Drone",
    faction: "synthetic_collective",
    role: "light_fighter",
    baseStats: {
      hull: 4,
      shields: 2,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["calculate", "target_lock", "barrel_roll"],
      pointCost: 40,
    },
    spriteKey: "ship_synth_heavy_drone",
    description: "Armored drone for sustained combat.",
  },
  synth_bomber_drone: {
    id: "synth_bomber_drone",
    name: "Bomber Drone",
    faction: "synthetic_collective",
    role: "bomber",
    baseStats: {
      hull: 3,
      shields: 2,
      attack: 2,
      agility: 2,
      speed: { min: 1, max: 3 },
      size: "small",
      actions: ["calculate", "target_lock", "reload"],
      pointCost: 36,
    },
    spriteKey: "ship_synth_bomber_drone",
    description: "Autonomous bombing unit.",
  },
  synth_interceptor_drone: {
    id: "synth_interceptor_drone",
    name: "Interceptor Drone",
    faction: "synthetic_collective",
    role: "interceptor",
    baseStats: {
      hull: 1,
      shields: 2,
      attack: 3,
      agility: 4,
      speed: { min: 1, max: 5 },
      size: "tiny",
      actions: ["calculate", "evade", "boost", "barrel_roll"],
      pointCost: 36,
    },
    spriteKey: "ship_synth_interceptor_drone",
    description:
      "Fast pursuit drone: a thin frame with no pilot to black out in hard turns.",
  },

  // Heavy Units (4)
  synth_hunter: {
    id: "synth_hunter",
    name: "Hunter Unit",
    faction: "synthetic_collective",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 3,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["calculate", "target_lock", "barrel_roll", "jam"],
      // Priced to the shipPricing heuristic (was 54, 3 under it): a novice
      // in a Hunter beat expert interceptors costing 23% less (skill gate 1).
      pointCost: 59,
    },
    spriteKey: "ship_synth_hunter",
    description: "Advanced combat unit with precise targeting.",
  },
  synth_stalker: {
    id: "synth_stalker",
    name: "Stalker Unit",
    faction: "synthetic_collective",
    role: "interceptor",
    baseStats: {
      hull: 4,
      shields: 3,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["calculate", "evade", "barrel_roll", "boost", "jam"],
      pointCost: 43,
    },
    spriteKey: "ship_synth_stalker",
    description: "Fast pursuit unit for target elimination.",
  },
  synth_ravager: {
    id: "synth_ravager",
    name: "Ravager Unit",
    faction: "synthetic_collective",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 4,
      attack: 4,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["calculate", "target_lock", "reinforce"],
      pointCost: 59,
    },
    spriteKey: "ship_synth_ravager",
    description: "Heavy assault unit for breakthrough attacks.",
  },
  synth_predator: {
    id: "synth_predator",
    name: "Predator Unit",
    faction: "synthetic_collective",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 3,
      attack: 4,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["calculate", "target_lock", "barrel_roll"],
      pointCost: 58,
    },
    spriteKey: "ship_synth_predator",
    description: "Optimized for target destruction.",
  },

  // Destroyers (2)
  synth_destroyer: {
    id: "synth_destroyer",
    name: "Destroyer Protocol",
    faction: "synthetic_collective",
    role: "bomber",
    baseStats: {
      hull: 5,
      shields: 3,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["calculate", "target_lock", "reload"],
      pointCost: 63,
    },
    spriteKey: "ship_synth_destroyer",
    description: "Heavy assault unit designed for capital ship hunting.",
  },
  synth_annihilator: {
    id: "synth_annihilator",
    name: "Annihilator Protocol",
    faction: "synthetic_collective",
    role: "bomber",
    baseStats: {
      hull: 6,
      shields: 4,
      attack: 5,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["calculate", "target_lock", "reload", "reinforce"],
      pointCost: 68,
    },
    spriteKey: "ship_synth_annihilator",
    description: "Maximum firepower assault platform.",
  },

  // Support Nodes (3)
  synth_carrier: {
    id: "synth_carrier",
    name: "Carrier Node",
    faction: "synthetic_collective",
    role: "support",
    baseStats: {
      hull: 8,
      shields: 5,
      attack: 2,
      agility: 1,
      speed: { min: 0, max: 2 },
      size: "large",
      actions: ["calculate", "coordinate", "reinforce", "jam"],
      pointCost: 75,
    },
    spriteKey: "ship_synth_carrier",
    description: "Command node that coordinates drone swarms.",
  },
  synth_relay_node: {
    id: "synth_relay_node",
    name: "Relay Node",
    faction: "synthetic_collective",
    role: "support",
    baseStats: {
      hull: 5,
      shields: 4,
      attack: 1,
      agility: 2,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["calculate", "coordinate", "jam"],
      pointCost: 60,
    },
    spriteKey: "ship_synth_relay_node",
    description: "Communication relay for extended network range.",
  },
  synth_repair_node: {
    id: "synth_repair_node",
    name: "Repair Node",
    faction: "synthetic_collective",
    role: "support",
    baseStats: {
      hull: 6,
      shields: 5,
      attack: 1,
      agility: 1,
      speed: { min: 1, max: 2 },
      size: "medium",
      actions: ["calculate", "coordinate", "reinforce"],
      pointCost: 62,
    },
    spriteKey: "ship_synth_repair_node",
    description: "Drone repair and resupply facility.",
  },

  // Gunships (2)
  synth_devastator: {
    id: "synth_devastator",
    name: "Devastator Platform",
    faction: "synthetic_collective",
    role: "gunship",
    baseStats: {
      hull: 7,
      shields: 4,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 2 },
      size: "medium",
      actions: ["calculate", "target_lock", "rotate_arc", "reinforce"],
      pointCost: 90,
    },
    spriteKey: "ship_synth_devastator",
    description: "Heavy weapons platform.",
  },
  synth_eradicator: {
    id: "synth_eradicator",
    name: "Eradicator Platform",
    faction: "synthetic_collective",
    role: "gunship",
    baseStats: {
      hull: 8,
      shields: 5,
      attack: 5,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "large",
      actions: ["calculate", "target_lock", "rotate_arc"],
      pointCost: 101,
    },
    spriteKey: "ship_synth_eradicator",
    description: "Maximum firepower siege platform.",
  },

  // Capital Ships (4)
  synth_nexus: {
    id: "synth_nexus",
    name: "Nexus Command Ship",
    faction: "synthetic_collective",
    role: "capital",
    baseStats: {
      hull: 36,
      shields: 24,
      armor: 1,
      attack: 4,
      agility: 0,
      speed: { min: 0, max: 1 },
      size: "huge",
      actions: ["calculate", "coordinate", "reinforce", "jam"],
      pointCost: 104,
    },
    spriteKey: "ship_synth_nexus",
    description: "Central processing node for fleet operations.",
  },
  synth_overmind: {
    id: "synth_overmind",
    name: "Overmind Carrier",
    faction: "synthetic_collective",
    role: "capital",
    baseStats: {
      hull: 27,
      shields: 21,
      armor: 1,
      attack: 3,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "huge",
      actions: ["calculate", "coordinate", "reinforce"],
      pointCost: 95,
    },
    spriteKey: "ship_synth_overmind",
    description: "Drone production vessel behind a dense shield lattice.",
  },
  synth_terminus: {
    id: "synth_terminus",
    name: "Terminus Battleship",
    faction: "synthetic_collective",
    role: "capital",
    baseStats: {
      hull: 33,
      shields: 21,
      armor: 1,
      attack: 5,
      agility: 0,
      speed: { min: 0, max: 1 },
      size: "huge",
      actions: ["calculate", "target_lock", "reinforce"],
      pointCost: 108,
    },
    spriteKey: "ship_synth_terminus",
    description: "Heavy battleship for fleet engagements.",
  },
  synth_gestalt: {
    id: "synth_gestalt",
    name: "Gestalt Colossus",
    faction: "synthetic_collective",
    role: "capital",
    baseStats: {
      hull: 48,
      shields: 36,
      armor: 1,
      attack: 6,
      agility: 0,
      speed: { min: 0, max: 1 },
      size: "huge",
      actions: ["calculate", "target_lock", "coordinate", "reinforce", "jam"],
      pointCost: 141,
    },
    spriteKey: "ship_synth_gestalt",
    description:
      "The hive mind manifest — countless drones converged into one apex form.",
  },
  synth_conduit: {
    id: "synth_conduit",
    name: "Conduit Cruiser",
    faction: "synthetic_collective",
    role: "capital",
    baseStats: {
      hull: 27,
      shields: 15,
      armor: 1,
      attack: 4,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "large",
      actions: ["calculate", "target_lock", "coordinate"],
      pointCost: 83,
    },
    spriteKey: "ship_synth_conduit",
    description: "Fast cruiser for network expansion.",
  },

  // ==========================================
  // VOID CORSAIRS (20 ships)
  // Theme: Pirates, raiders, stealth, boarding, hit-and-run
  // ==========================================

  // Interceptors (4)
  corsair_blade: {
    id: "corsair_blade",
    name: "Blade Raider",
    faction: "void_corsairs",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 1,
      attack: 4,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "boost", "barrel_roll"],
      pointCost: 35,
    },
    spriteKey: "ship_corsair_blade",
    description: "Glass-cannon attack craft favored by pirate aces.",
  },
  corsair_fang: {
    id: "corsair_fang",
    name: "Fang Interceptor",
    faction: "void_corsairs",
    role: "interceptor",
    baseStats: {
      hull: 2,
      shields: 1,
      attack: 3,
      agility: 4,
      speed: { min: 1, max: 5 },
      size: "tiny",
      actions: ["focus", "evade", "boost", "barrel_roll"],
      pointCost: 28,
    },
    spriteKey: "ship_corsair_fang",
    description: "Ultra-fast strike craft: stripped shields, hot-rodded banks.",
  },
  corsair_talon: {
    id: "corsair_talon",
    name: "Talon Strike Fighter",
    faction: "void_corsairs",
    role: "interceptor",
    baseStats: {
      hull: 4,
      shields: 1,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "target_lock", "barrel_roll", "boost"],
      pointCost: 35,
    },
    spriteKey: "ship_corsair_talon",
    description:
      "Armour-plated strike fighter, tuned to bank hard at full burn.",
  },
  corsair_venom: {
    id: "corsair_venom",
    name: "Venom Light Fighter",
    faction: "void_corsairs",
    role: "light_fighter",
    baseStats: {
      hull: 4,
      shields: 2,
      attack: 2,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "tiny",
      actions: ["focus", "evade", "barrel_roll"],
      pointCost: 40,
    },
    spriteKey: "ship_corsair_venom",
    description: "Cheap raider: scrap armour for shields, banks hard at speed.",
  },

  // Heavy Fighters (4)
  corsair_marauder: {
    id: "corsair_marauder",
    name: "Marauder Assault Ship",
    faction: "void_corsairs",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 2,
      attack: 4,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "barrel_roll"],
      pointCost: 50,
    },
    spriteKey: "ship_corsair_marauder",
    description: "Heavily armed raider built for close combat.",
  },
  corsair_cutlass: {
    id: "corsair_cutlass",
    name: "Cutlass Heavy Fighter",
    faction: "void_corsairs",
    role: "heavy_fighter",
    baseStats: {
      hull: 4,
      shields: 3,
      attack: 4,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 53,
    },
    spriteKey: "ship_corsair_cutlass",
    description:
      "Pirate boarding fighter: big guns, light plating, hard banks at speed.",
  },
  corsair_scimitar: {
    id: "corsair_scimitar",
    name: "Scimitar Fighter",
    faction: "void_corsairs",
    role: "heavy_fighter",
    baseStats: {
      hull: 4,
      shields: 3,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "evade", "target_lock", "barrel_roll"],
      pointCost: 53,
    },
    spriteKey: "ship_corsair_scimitar",
    description: "Balanced pirate fighter.",
  },
  corsair_saber: {
    id: "corsair_saber",
    name: "Saber Attack Fighter",
    faction: "void_corsairs",
    role: "heavy_fighter",
    baseStats: {
      hull: 4,
      shields: 2,
      attack: 4,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "boost"],
      pointCost: 45,
    },
    spriteKey: "ship_corsair_saber",
    description: "Fast attack fighter.",
  },

  // Stealth Ships (3)
  corsair_specter: {
    id: "corsair_specter",
    name: "Specter Infiltrator",
    faction: "void_corsairs",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 2,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "barrel_roll", "cloak", "coordinate"],
      pointCost: 43,
    },
    spriteKey: "ship_corsair_specter",
    description: "Stealth raider used for ambush and sabotage.",
  },
  corsair_phantom: {
    id: "corsair_phantom",
    name: "Phantom Stealth Ship",
    faction: "void_corsairs",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 3,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "cloak", "barrel_roll"],
      pointCost: 43,
    },
    spriteKey: "ship_corsair_phantom",
    description: "Advanced cloaking vessel with a raider's hot-rodded banks.",
  },
  corsair_shadow: {
    id: "corsair_shadow",
    name: "Shadow Strike Ship",
    faction: "void_corsairs",
    role: "interceptor",
    baseStats: {
      hull: 4,
      shields: 2,
      attack: 4,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "barrel_roll", "cloak", "target_lock"],
      pointCost: 43,
    },
    spriteKey: "ship_corsair_shadow",
    description: "Heavy stealth attack craft.",
  },

  // Gunships (3)
  corsair_reaver: {
    id: "corsair_reaver",
    name: "Reaver Gunboat",
    faction: "void_corsairs",
    role: "gunship",
    baseStats: {
      hull: 7,
      shields: 2,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "rotate_arc"],
      pointCost: 87,
    },
    spriteKey: "ship_corsair_reaver",
    description: "Brutal gunboat designed to overwhelm targets.",
  },
  corsair_pillager: {
    id: "corsair_pillager",
    name: "Pillager Assault Ship",
    faction: "void_corsairs",
    role: "gunship",
    baseStats: {
      hull: 8,
      shields: 3,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "large",
      actions: ["focus", "target_lock", "rotate_arc", "reinforce"],
      pointCost: 96,
    },
    spriteKey: "ship_corsair_pillager",
    description: "Heavy raider for merchant hunting.",
  },
  corsair_ravager: {
    id: "corsair_ravager",
    name: "Ravager War Galley",
    faction: "void_corsairs",
    role: "gunship",
    baseStats: {
      hull: 6,
      shields: 3,
      attack: 5,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "large",
      actions: ["focus", "target_lock", "coordinate"],
      pointCost: 86,
    },
    spriteKey: "ship_corsair_ravager",
    description: "Fast attack galley.",
  },

  // Bombers (2)
  corsair_bomber: {
    id: "corsair_bomber",
    name: "Corsair Bomber",
    faction: "void_corsairs",
    role: "bomber",
    baseStats: {
      hull: 5,
      shields: 2,
      attack: 3,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "reload"],
      pointCost: 45,
    },
    spriteKey: "ship_corsair_bomber",
    description: "Standard pirate bomber.",
  },
  corsair_torpedo_boat: {
    id: "corsair_torpedo_boat",
    name: "Torpedo Boat",
    faction: "void_corsairs",
    role: "bomber",
    baseStats: {
      hull: 4,
      shields: 2,
      attack: 2,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "boost"],
      pointCost: 42,
    },
    spriteKey: "ship_corsair_torpedo_boat",
    description: "Fast torpedo attack craft that banks hard at speed.",
  },

  // Capital Ships (3)
  corsair_dreadnought: {
    id: "corsair_dreadnought",
    name: "Dreadnought Flagship",
    faction: "void_corsairs",
    role: "capital",
    baseStats: {
      hull: 36,
      shields: 18,
      armor: 1,
      attack: 5,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "huge",
      actions: ["focus", "target_lock", "coordinate", "reinforce"],
      pointCost: 110,
    },
    spriteKey: "ship_corsair_dreadnought",
    description: "Pirate lord flagship.",
  },
  corsair_galleon: {
    id: "corsair_galleon",
    name: "Void Galleon",
    faction: "void_corsairs",
    role: "capital",
    baseStats: {
      hull: 30,
      shields: 15,
      armor: 1,
      attack: 4,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "huge",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 91,
    },
    spriteKey: "ship_corsair_galleon",
    description: "Heavy pirate warship.",
  },
  corsair_frigate: {
    id: "corsair_frigate",
    name: "Raider Frigate",
    faction: "void_corsairs",
    role: "capital",
    baseStats: {
      hull: 27,
      shields: 9,
      armor: 1,
      attack: 4,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "large",
      actions: ["focus", "target_lock", "coordinate"],
      pointCost: 75,
    },
    spriteKey: "ship_corsair_frigate",
    description: "Fast raiding frigate: scrap armour over weak shields.",
  },

  // Support Ships (1)
  corsair_tender: {
    id: "corsair_tender",
    name: "Fleet Tender",
    faction: "void_corsairs",
    role: "support",
    baseStats: {
      hull: 7,
      shields: 4,
      attack: 2,
      agility: 1,
      speed: { min: 1, max: 2 },
      size: "large",
      actions: ["focus", "coordinate", "reinforce"],
      pointCost: 65,
    },
    spriteKey: "ship_corsair_tender",
    description: "Supply and repair vessel.",
  },

  // ==========================================
  // ASCENDANT EMPIRE (20 ships)
  // Theme: Force powers, religious zealots, elite warriors, advanced tech
  // ==========================================

  // Interceptors (4)
  ascendant_seraph: {
    id: "ascendant_seraph",
    name: "Seraph Guardian",
    faction: "ascendant_empire",
    role: "interceptor",
    baseStats: {
      hull: 4,
      shields: 3,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "boost", "barrel_roll"],
      pointCost: 43,
    },
    spriteKey: "ship_ascendant_seraph",
    description: "Elite fighter piloted by force-sensitive warriors.",
  },
  ascendant_cherub: {
    id: "ascendant_cherub",
    name: "Cherub Light Fighter",
    faction: "ascendant_empire",
    role: "light_fighter",
    baseStats: {
      hull: 2,
      shields: 3,
      attack: 2,
      agility: 3,
      speed: { min: 1, max: 4 },
      size: "tiny",
      actions: ["focus", "evade", "barrel_roll"],
      pointCost: 34,
    },
    spriteKey: "ship_ascendant_cherub",
    description:
      "Initiate fighter: heavy shields and a gentle dial, no sprint.",
  },
  ascendant_herald: {
    id: "ascendant_herald",
    name: "Herald Scout",
    faction: "ascendant_empire",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 3,
      attack: 2,
      agility: 4,
      speed: { min: 1, max: 5 },
      size: "small",
      actions: ["focus", "evade", "barrel_roll", "boost", "coordinate"],
      pointCost: 38,
    },
    spriteKey: "ship_ascendant_herald",
    description: "Fast reconnaissance craft.",
  },
  ascendant_virtue: {
    id: "ascendant_virtue",
    name: "Virtue Interceptor",
    faction: "ascendant_empire",
    role: "interceptor",
    baseStats: {
      hull: 3,
      shields: 3,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "evade", "target_lock", "barrel_roll", "boost"],
      pointCost: 39,
    },
    spriteKey: "ship_ascendant_virtue",
    description:
      "Shielded picket of the faithful: slower, but banks serenely at speed.",
  },

  // Heavy Fighters (4)
  ascendant_templar: {
    id: "ascendant_templar",
    name: "Templar Heavy Fighter",
    faction: "ascendant_empire",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 4,
      attack: 3,
      agility: 1,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 58,
    },
    spriteKey: "ship_ascendant_templar",
    description:
      "Temple guard: slow to dodge, heavy shields, steady low-speed banks.",
  },
  ascendant_crusader: {
    id: "ascendant_crusader",
    name: "Crusader Assault Fighter",
    faction: "ascendant_empire",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 4,
      attack: 4,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 58,
    },
    spriteKey: "ship_ascendant_crusader",
    description: "Heavy assault craft for holy wars.",
  },
  ascendant_paladin: {
    id: "ascendant_paladin",
    name: "Paladin Fighter",
    faction: "ascendant_empire",
    role: "heavy_fighter",
    baseStats: {
      hull: 5,
      shields: 3,
      attack: 3,
      agility: 3,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "coordinate"],
      pointCost: 60,
    },
    spriteKey: "ship_ascendant_paladin",
    description: "Knight-class escort fighter.",
  },
  ascendant_inquisitor: {
    id: "ascendant_inquisitor",
    name: "Inquisitor Strike Fighter",
    faction: "ascendant_empire",
    role: "heavy_fighter",
    baseStats: {
      hull: 4,
      shields: 4,
      attack: 4,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: ["focus", "target_lock", "jam"],
      pointCost: 53,
    },
    spriteKey: "ship_ascendant_inquisitor",
    description: "Hunter of heretics and apostates.",
  },

  // Support Ships (3)
  ascendant_oracle: {
    id: "ascendant_oracle",
    name: "Oracle Support Craft",
    faction: "ascendant_empire",
    role: "support",
    baseStats: {
      hull: 5,
      shields: 5,
      attack: 2,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "coordinate", "reinforce", "jam"],
      pointCost: 72,
    },
    spriteKey: "ship_ascendant_oracle",
    description:
      "Foresighted support craft: deep shields and calm low-speed banks.",
  },
  ascendant_prophet: {
    id: "ascendant_prophet",
    name: "Prophet Command Ship",
    faction: "ascendant_empire",
    role: "support",
    baseStats: {
      hull: 6,
      shields: 6,
      attack: 2,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "coordinate", "reinforce", "jam"],
      pointCost: 72,
    },
    spriteKey: "ship_ascendant_prophet",
    description: "Fleet command and coordination vessel.",
  },
  ascendant_acolyte: {
    id: "ascendant_acolyte",
    name: "Acolyte Tender",
    faction: "ascendant_empire",
    role: "support",
    baseStats: {
      hull: 4,
      shields: 4,
      attack: 1,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "coordinate", "reinforce"],
      pointCost: 53,
    },
    spriteKey: "ship_ascendant_acolyte",
    description: "Supply and repair vessel.",
  },

  // Gunships (3)
  ascendant_avatar: {
    id: "ascendant_avatar",
    name: "Avatar Assault Ship",
    faction: "ascendant_empire",
    role: "gunship",
    baseStats: {
      hull: 6,
      shields: 5,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "large",
      actions: ["focus", "target_lock", "reinforce", "rotate_arc"],
      pointCost: 94,
    },
    spriteKey: "ship_ascendant_avatar",
    description: "Powerful assault craft housing elite warriors.",
  },
  ascendant_wrath: {
    id: "ascendant_wrath",
    name: "Wrath Gunship",
    faction: "ascendant_empire",
    role: "gunship",
    baseStats: {
      hull: 7,
      shields: 4,
      attack: 5,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "rotate_arc"],
      pointCost: 95,
    },
    spriteKey: "ship_ascendant_wrath",
    description: "Divine judgment made manifest.",
  },
  ascendant_judgment: {
    id: "ascendant_judgment",
    name: "Judgment Heavy Gunship",
    faction: "ascendant_empire",
    role: "gunship",
    baseStats: {
      hull: 8,
      shields: 5,
      attack: 5,
      agility: 0,
      speed: { min: 1, max: 2 },
      size: "large",
      actions: ["focus", "target_lock", "rotate_arc", "reinforce"],
      pointCost: 94,
    },
    spriteKey: "ship_ascendant_judgment",
    description: "Heavy assault platform.",
  },

  // Bombers (2)
  ascendant_smiter: {
    id: "ascendant_smiter",
    name: "Smiter Bomber",
    faction: "ascendant_empire",
    role: "bomber",
    baseStats: {
      hull: 5,
      shields: 4,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 3 },
      size: "medium",
      actions: ["focus", "target_lock", "reload"],
      pointCost: 63,
    },
    spriteKey: "ship_ascendant_smiter",
    description: "Standard assault bomber.",
  },
  ascendant_purifier: {
    id: "ascendant_purifier",
    name: "Purifier Heavy Bomber",
    faction: "ascendant_empire",
    role: "bomber",
    baseStats: {
      hull: 6,
      shields: 5,
      attack: 4,
      agility: 1,
      speed: { min: 1, max: 2 },
      size: "large",
      actions: ["focus", "target_lock", "reload", "reinforce"],
      pointCost: 65,
    },
    spriteKey: "ship_ascendant_purifier",
    description: "Ponderous cleansing bomber: deep shields, no sprint.",
  },

  // Capital Ships (4)
  ascendant_divine: {
    id: "ascendant_divine",
    name: "Divine Sovereignty",
    faction: "ascendant_empire",
    role: "capital",
    baseStats: {
      hull: 42,
      shields: 30,
      armor: 1,
      attack: 5,
      agility: 0,
      speed: { min: 0, max: 1 },
      size: "huge",
      actions: ["focus", "target_lock", "coordinate", "reinforce"],
      pointCost: 127,
    },
    spriteKey: "ship_ascendant_divine",
    description: "Supreme flagship of the Empire.",
  },
  ascendant_glory: {
    id: "ascendant_glory",
    name: "Glory Battleship",
    faction: "ascendant_empire",
    role: "capital",
    baseStats: {
      hull: 36,
      shields: 24,
      armor: 1,
      attack: 5,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "huge",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 118,
    },
    spriteKey: "ship_ascendant_glory",
    description: "Main battleship of the faithful.",
  },
  ascendant_sanctum: {
    id: "ascendant_sanctum",
    name: "Sanctum Carrier",
    faction: "ascendant_empire",
    role: "capital",
    baseStats: {
      hull: 30,
      shields: 21,
      armor: 1,
      attack: 3,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "huge",
      actions: ["focus", "coordinate", "reinforce"],
      pointCost: 99,
    },
    spriteKey: "ship_ascendant_sanctum",
    description: "Sacred carrier vessel.",
  },
  ascendant_bastion: {
    id: "ascendant_bastion",
    name: "Bastion Cruiser",
    faction: "ascendant_empire",
    role: "capital",
    baseStats: {
      hull: 27,
      shields: 18,
      armor: 1,
      attack: 4,
      agility: 0,
      speed: { min: 0, max: 2 },
      size: "large",
      actions: ["focus", "target_lock", "reinforce"],
      pointCost: 86,
    },
    spriteKey: "ship_ascendant_bastion",
    description: "Heavy cruiser of the temple fleet.",
  },
};

// ============================================
// Maneuver Dial Lookup
// ============================================

/** Each ship's dial as authored (shared base dials, variant tweaks). */
const AUTHORED_DIALS: Record<string, readonly ManeuverDefinition[]> = {
  // ── TERRAN HEGEMONY ──────────────────────────────────────────────────────
  terran_viper: VIPER_DIAL,
  terran_stiletto: STILETTO_DIAL, // tiny light_fighter — Z-95 tier
  terran_raptor: INTERCEPTOR_DIAL,
  terran_gladius: FIGHTER_DIAL,
  terran_centurion: CENTURION_DIAL,
  terran_praetorian: FIGHTER_DIAL,
  terran_legionnaire: FIGHTER_DIAL,
  terran_hammer: BOMBER_DIAL,
  terran_thunderbolt: BOMBER_DIAL,
  terran_javelin: JAVELIN_DIAL, // fast bomber: white straight at top speed 4
  terran_sentinel: SUPPORT_DIAL, // fix: support vessels
  terran_guardian: SUPPORT_DIAL,
  terran_harbinger: HARBINGER_DIAL, // ODD DUCK: white K-turn @ speed 2
  terran_bastion: GUNSHIP_DIAL, // fix: gunship, not bomber
  terran_bulwark: GUNSHIP_DIAL, // fix: large gunship, not capital
  terran_vindicator: VINDICATOR_DIAL,
  terran_imperator: CAPITAL_DIAL,
  terran_dominator: CAPITAL_DIAL,
  terran_executor: CAPITAL_DIAL,
  terran_consul: CAPITAL_DIAL,

  // ── FREE CONFEDERATION ───────────────────────────────────────────────────
  confed_sparrow: LIGHT_FIGHTER_DIAL, // light_fighter — nimble but simple
  confed_wasp: LIGHT_FIGHTER_DIAL, // light_fighter — Z-95 tier
  confed_finch: FINCH_DIAL, // light_fighter — scout, green turn @ 1 + banks @ 2
  confed_kestrel: KESTREL_DIAL, // green hard turn @ speed 1
  confed_falcon: FIGHTER_DIAL,
  confed_hawk: HAWK_DIAL, // green hard turn @ speed 1
  confed_eagle: FIGHTER_DIAL,
  confed_condor: FIGHTER_DIAL,
  confed_raven: INTERCEPTOR_DIAL,
  confed_owl: INTERCEPTOR_DIAL,
  confed_pelican: PELICAN_DIAL,
  confed_albatross: ALBATROSS_DIAL, // ODD DUCK: freighter — speed 0–4, no turns
  confed_phoenix: GUNSHIP_DIAL, // fix: gunship, not bomber
  confed_thunderbird: GUNSHIP_DIAL,
  confed_harrier: GUNSHIP_DIAL, // fix: gunship (was FIGHTER)
  confed_crane: SUPPORT_DIAL,
  confed_heron: SUPPORT_DIAL,
  confed_liberty: CAPITAL_DIAL,
  confed_independence: CAPITAL_DIAL,
  confed_defiance: CAPITAL_DIAL,

  // ── SYNTHETIC COLLECTIVE ─────────────────────────────────────────────────
  synth_drone: DRONE_DIAL, // light_fighter — basic combat drone, green turn @ 2
  synth_scout_drone: DRONE_DIAL, // light_fighter — scout drone, green turn @ 2
  synth_heavy_drone: FIGHTER_DIAL,
  synth_bomber_drone: BOMBER_DIAL,
  synth_interceptor_drone: SWARM_INTERCEPTOR_DIAL, // white turn @ speed 3
  synth_hunter: HUNTER_DIAL, // ODD DUCK: IG-88 chassis A
  synth_stalker: HUNTER_DIAL, // ODD DUCK: IG-88 chassis B (same dial)
  synth_ravager: HUNTER_DIAL, // ODD DUCK: IG-88 chassis C (same dial)
  synth_predator: FIGHTER_DIAL,
  synth_destroyer: BOMBER_DIAL,
  synth_annihilator: BOMBER_DIAL,
  synth_carrier: CAPITAL_DIAL,
  synth_relay_node: SUPPORT_DIAL, // fix: support (was FIGHTER)
  synth_repair_node: SUPPORT_DIAL,
  synth_devastator: GUNSHIP_DIAL, // fix: gunship (was BOMBER)
  synth_eradicator: GUNSHIP_DIAL, // fix: large gunship (was CAPITAL)
  synth_nexus: CAPITAL_DIAL,
  synth_overmind: CAPITAL_DIAL,
  synth_terminus: CAPITAL_DIAL,
  synth_gestalt: CAPITAL_DIAL,
  synth_conduit: CAPITAL_DIAL,

  // ── VOID CORSAIRS ────────────────────────────────────────────────────────
  corsair_blade: INTERCEPTOR_DIAL,
  corsair_fang: RAIDER_DIAL, // white banks @ speed 4
  corsair_talon: RAIDER_DIAL, // white banks @ speed 4
  corsair_venom: VENOM_DIAL, // light_fighter — cheap raider, white banks @ 3
  corsair_marauder: FIGHTER_DIAL,
  corsair_cutlass: CUTLASS_DIAL, // white banks @ speed 3
  corsair_scimitar: FIGHTER_DIAL,
  corsair_saber: FIGHTER_DIAL,
  corsair_specter: INTERCEPTOR_DIAL,
  corsair_phantom: RAIDER_DIAL, // white banks @ speed 4
  corsair_shadow: INTERCEPTOR_DIAL,
  corsair_reaver: GUNSHIP_DIAL, // fix: gunship (was BOMBER)
  corsair_pillager: GUNSHIP_DIAL,
  corsair_ravager: GUNSHIP_DIAL,
  corsair_bomber: BOMBER_DIAL,
  corsair_torpedo_boat: TORPEDO_BOAT_DIAL, // ODD DUCK: white K-turn + segnors
  corsair_dreadnought: CAPITAL_DIAL,
  corsair_galleon: CAPITAL_DIAL,
  corsair_frigate: CAPITAL_DIAL,
  corsair_tender: SUPPORT_DIAL, // fix: support (was CAPITAL)

  // ── ASCENDANT EMPIRE ─────────────────────────────────────────────────────
  ascendant_seraph: INTERCEPTOR_DIAL,
  ascendant_cherub: CHERUB_DIAL, // light_fighter — initiates, green banks @ 2
  ascendant_herald: INTERCEPTOR_DIAL,
  ascendant_virtue: VIRTUE_DIAL, // green banks @ speed 3
  ascendant_templar: TEMPLAR_DIAL, // green banks @ speed 1
  ascendant_crusader: FIGHTER_DIAL,
  ascendant_paladin: FIGHTER_DIAL,
  ascendant_inquisitor: FIGHTER_DIAL,
  ascendant_oracle: ORACLE_DIAL, // support, green banks @ speed 1
  ascendant_prophet: SUPPORT_DIAL,
  ascendant_acolyte: ACOLYTE_DIAL,
  ascendant_avatar: AVATAR_DIAL, // ODD DUCK: segnor + white K-turn
  ascendant_wrath: GUNSHIP_DIAL, // fix: gunship (was BOMBER)
  ascendant_judgment: GUNSHIP_DIAL, // fix: large gunship (was CAPITAL)
  ascendant_smiter: BOMBER_DIAL,
  ascendant_purifier: BOMBER_DIAL,
  ascendant_divine: CAPITAL_DIAL,
  ascendant_glory: GLORY_DIAL,
  ascendant_sanctum: CAPITAL_DIAL,
  ascendant_bastion: CAPITAL_DIAL,
};

/**
 * Every ship's dial as it flies: the authored dial without the rows above
 * the ship's top speed (they could never be dialled in).
 */
export const SHIP_DIALS: Record<string, readonly ManeuverDefinition[]> =
  Object.fromEntries(
    Object.entries(AUTHORED_DIALS).map(([id, dial]) => [
      id,
      withinTopSpeed(dial, SHIP_DEFINITIONS[id]?.baseStats.speed.max ?? 5),
    ]),
  );

// ============================================
// Helper Functions
// ============================================

export function getShipDefinition(id: string): ShipDefinition | undefined {
  return SHIP_DEFINITIONS[id];
}

export function getShipDial(
  definitionId: string,
): readonly ManeuverDefinition[] {
  return SHIP_DIALS[definitionId] ?? FIGHTER_DIAL;
}

/** Movement profile determines intra-cycle interpolation curve. */
export type MovementProfile = "fighter" | "capital";

/**
 * Returns the movement profile for a ship definition.
 * Capital profile = boat-style easing (committed turns, no snap).
 *
 * @param definitionId - Ship definition ID.
 */
export function getMovementProfile(definitionId: string): MovementProfile {
  if (AUTHORED_DIALS[definitionId] === CAPITAL_DIAL) return "capital";
  const def = SHIP_DEFINITIONS[definitionId];
  if (def?.baseStats.size === "huge") return "capital";
  return "fighter";
}

export function getShipsByFaction(faction: FactionId): ShipDefinition[] {
  return Object.values(SHIP_DEFINITIONS).filter(
    (ship) => ship.faction === faction,
  );
}

export function getShipsByRole(role: string): ShipDefinition[] {
  return Object.values(SHIP_DEFINITIONS).filter((ship) => ship.role === role);
}
