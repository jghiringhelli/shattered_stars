/**
 * Choir-Hive — Survival sector 3 (final) boss. A brood-queen of the Reach
 * that learned to sing: the Vaelith chorus that once woke the Warden left an
 * echo in the hive's throat-sacs, and it screams back. A slow spinning core
 * ringed by brood pods (shoot them for ×1.5 damage), it calls gnawer adds,
 * volleys thorns, blooms spores and — in its last phases — screams at loud
 * minds. Destroy the brood sac and it cannot call more brood; destroy the
 * choir throat and the scream is gone.
 */

import type { CreatureDefinition } from "./creatureTypes";

export const CHOIR_HIVE: CreatureDefinition = {
  id: "choir_hive",
  name: "Choir-Hive",
  sizeClass: "huge",
  radiusPx: 110,
  hullPoints: 56,
  shieldPoints: 14,
  movement: {
    style: "hive",
    speedPxPerS: 55,
    turnDegPerS: 16,
    standoffPx: 480,
    amplitude: 0,
    periodMs: 8000,
  },
  powers: [
    {
      id: "thorn_volley",
      name: "THORN VOLLEY",
      kind: "cone",
      targeting: "nearest",
      windupCycles: 1,
      cooldownCycles: 5,
      damage: 5,
      stress: 0.1,
      rangePx: 520,
      arcDeg: 50,
      fromPhase: 0,
      weight: 3,
    },
    {
      id: "brood_call",
      name: "BROOD CALL",
      kind: "summon",
      targeting: "nearest",
      windupCycles: 2,
      cooldownCycles: 15,
      damage: 0,
      stress: 0,
      rangePx: 0,
      spawnCount: 2,
      spawnCreatureId: "hulk_gnawer",
      requiresPart: "brood_sac",
      fromPhase: 0,
      weight: 2,
    },
    {
      id: "spore_bloom",
      name: "SPORE BLOOM",
      kind: "cloud",
      targeting: "cluster",
      windupCycles: 1,
      cooldownCycles: 6,
      damage: 0,
      stress: 0.12,
      rangePx: 250,
      durationMs: 4500,
      slowFactor: 0.6,
      triggerRangePx: 640,
      fromPhase: 1,
      weight: 2,
    },
    {
      id: "choir_scream",
      name: "CHOIR SCREAM",
      kind: "scream",
      targeting: "flagship",
      windupCycles: 2,
      cooldownCycles: 7,
      damage: 3,
      stress: 0.3,
      rangePx: 720,
      requiresPart: "choir_throat",
      fromPhase: 1,
      weight: 2,
    },
  ],
  parts: [
    ...[45, 135, 225, 315].map((bearingDeg, i) => ({
      id: `brood_pod_${i + 1}`,
      name: "Brood pod",
      hpPoints: 2,
      bearingDeg,
      arcDeg: 50,
      damageMultiplier: 1.5,
      offsetPx: 135,
    })),
    {
      id: "brood_sac",
      name: "Brood sac",
      hpPoints: 3,
      bearingDeg: 180,
      arcDeg: 40,
      damageMultiplier: 1.3,
      offsetPx: 100,
    },
    {
      id: "choir_throat",
      name: "Choir throat",
      hpPoints: 3,
      bearingDeg: 0,
      arcDeg: 40,
      damageMultiplier: 1.3,
      offsetPx: 100,
    },
  ],
  phases: [
    { name: "NESTING", speedScale: 1, cooldownScale: 1, damageScale: 1 },
    { name: "SINGING", speedScale: 1.2, cooldownScale: 0.8, damageScale: 1.05 },
    {
      name: "CRESCENDO",
      speedScale: 1.4,
      cooldownScale: 0.6,
      damageScale: 1.15,
    },
  ],
  feedHullPoints: 2,
  isBoss: true,
  segmentCount: 0,
  spriteStem: "choir_hive",
  lore: {
    epithet: "The Brood That Answers",
    origin:
      "Nested in a drowned Vaelith relay; its throats resonate with the chorus that woke the Warden ten thousand years ago.",
    description:
      "Survivors say it hums a three-note descent — the same one OMEGA-7 heard in Prime's choir. The Choir-Hive is not the Tide, but it is loud, and the loud things of the Reach have started to sing together.",
    tactics:
      "Pop pods for ×1.5 hits while the core spins past; silence the choir throat to stop the scream, cut the brood sac from behind to stop the gnawers. Kill the gnawers fast — the hive eats their wrecks.",
  },
};
