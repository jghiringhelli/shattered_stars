/**
 * The standard (non-boss) creatures: the Tidecell, the Void Tide's small
 * outrider that hunts loud minds, and the Hulk Gnawer, ordinary Reach
 * wildlife that eats wrecks. Both appear as hazard-mission and Survival
 * event spawns and as the adds bosses call.
 */

import type { CreatureDefinition } from "./creatureTypes";

export const TIDECELL: CreatureDefinition = {
  id: "tidecell",
  name: "Tidecell",
  sizeClass: "small",
  radiusPx: 26,
  hullPoints: 3,
  shieldPoints: 0,
  movement: {
    style: "orbit_lunge",
    speedPxPerS: 200,
    turnDegPerS: 160,
    standoffPx: 260,
    amplitude: 0,
    periodMs: 3000,
  },
  powers: [
    {
      id: "loud_mind_strike",
      name: "LUNGE",
      kind: "lunge",
      targeting: "flagship",
      windupCycles: 1,
      cooldownCycles: 4,
      damage: 5,
      stress: 0.35,
      rangePx: 320,
      durationMs: 450,
      triggerRangePx: 420,
      fromPhase: 0,
      weight: 1,
    },
  ],
  parts: [],
  phases: [
    { name: "HUNTING", speedScale: 1, cooldownScale: 1, damageScale: 1 },
  ],
  feedHullPoints: 0,
  isBoss: false,
  segmentCount: 0,
  spriteStem: "tidecell",
  lore: {
    epithet: "The Tide's Outrider",
    origin:
      "A small construct unmade from lane matter by the Warden; the first sign that the Void Tide has noticed a system.",
    description:
      "Tidecells hunt single minds, not ships. They circle at the edge of sensor range until the loudest pilot in the wing is alone, then dive at it. They do not eat; they only silence.",
    tactics:
      "Lunge wind-up is a thin line: sidestep it and the cell overshoots. Kill it while it circles; it breaks formation after each lunge.",
  },
};

export const HULK_GNAWER: CreatureDefinition = {
  id: "hulk_gnawer",
  name: "Hulk Gnawer",
  sizeClass: "small",
  radiusPx: 34,
  hullPoints: 5,
  shieldPoints: 0,
  movement: {
    style: "serpentine",
    speedPxPerS: 130,
    turnDegPerS: 120,
    standoffPx: 160,
    amplitude: 24,
    periodMs: 1800,
  },
  powers: [
    {
      id: "gnaw",
      name: "GNAW",
      kind: "cone",
      targeting: "nearest",
      windupCycles: 1,
      cooldownCycles: 2,
      damage: 3,
      stress: 0.05,
      rangePx: 130,
      arcDeg: 90,
      fromPhase: 0,
      weight: 1,
    },
  ],
  parts: [],
  phases: [
    { name: "GNAWING", speedScale: 1, cooldownScale: 1, damageScale: 1 },
  ],
  feedHullPoints: 1,
  isBoss: false,
  segmentCount: 3,
  spriteStem: "hulk_gnawer",
  lore: {
    epithet: "Wreck-Eater",
    origin:
      "A vacuum worm of the Reach's debris rings, drawn by hull-metal and the heat of fresh wrecks.",
    description:
      "Salvage crews hate gnawers more than raiders: a raider leaves a wreck, a gnawer leaves a ring of rust. They are harmless in a patrol and a plague around a battle.",
    tactics:
      "Its bite is a short fan — keep your nose on it and fly out of its arc. Kill it before it reaches a wreck: a fed gnawer heals.",
  },
};
