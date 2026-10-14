/**
 * Cinder Wyrm — Survival sector 1 boss. Ordinary Reach wildlife grown huge:
 * a plasma-furnace serpent that nests in the slag of the eleven broken
 * stars. It pursues in a sine-wave undulation, breathes a telegraphed cone,
 * lunges and, once the tail gland is gone, can no longer nova. Opening
 * lesson of the bestiary: read the wind-up, leave the lane, hit the tail.
 */

import type { CreatureDefinition } from "./creatureTypes";

export const CINDER_WYRM: CreatureDefinition = {
  id: "cinder_wyrm",
  name: "Cinder Wyrm",
  sizeClass: "large",
  radiusPx: 70,
  hullPoints: 56,
  shieldPoints: 12,
  movement: {
    style: "serpentine",
    speedPxPerS: 150,
    turnDegPerS: 95,
    standoffPx: 240,
    amplitude: 30,
    periodMs: 2600,
  },
  powers: [
    {
      id: "cinder_spray",
      name: "CINDER SPRAY",
      kind: "cone",
      targeting: "nearest",
      windupCycles: 1,
      cooldownCycles: 6,
      damage: 6,
      stress: 0.15,
      rangePx: 340,
      arcDeg: 70,
      requiresPart: "furnace_throat",
      fromPhase: 0,
      weight: 3,
    },
    {
      id: "wyrm_strike",
      name: "WYRM STRIKE",
      kind: "lunge",
      targeting: "flagship",
      windupCycles: 2,
      cooldownCycles: 9,
      damage: 8,
      stress: 0.2,
      rangePx: 420,
      durationMs: 600,
      triggerRangePx: 520,
      fromPhase: 0,
      weight: 2,
    },
    {
      id: "ember_nova",
      name: "EMBER NOVA",
      kind: "ring",
      targeting: "nearest",
      windupCycles: 2,
      cooldownCycles: 10,
      damage: 9,
      stress: 0.25,
      rangePx: 320,
      innerRangePx: 130,
      requiresPart: "ember_gland",
      fromPhase: 1,
      weight: 2,
    },
  ],
  parts: [
    {
      id: "furnace_throat",
      name: "Furnace throat",
      hpPoints: 3,
      bearingDeg: 0,
      arcDeg: 44,
      damageMultiplier: 1.3,
      offsetPx: 60,
    },
    {
      id: "ember_gland",
      name: "Ember gland",
      hpPoints: 3,
      bearingDeg: 180,
      arcDeg: 110,
      damageMultiplier: 1.7,
      offsetPx: 70,
    },
    {
      id: "slag_plates",
      name: "Slag plates",
      hpPoints: 4,
      bearingDeg: 90,
      arcDeg: 70,
      damageMultiplier: 0.7,
      offsetPx: 50,
    },
    {
      id: "slag_plates_port",
      name: "Slag plates",
      hpPoints: 4,
      bearingDeg: -90,
      arcDeg: 70,
      damageMultiplier: 0.7,
      offsetPx: 50,
    },
  ],
  phases: [
    { name: "HUNTING", speedScale: 1, cooldownScale: 1, damageScale: 1 },
    { name: "FRENZY", speedScale: 1.25, cooldownScale: 0.7, damageScale: 1.1 },
    { name: "MOLTING", speedScale: 1.4, cooldownScale: 0.55, damageScale: 1.2 },
  ],
  feedHullPoints: 0,
  isBoss: true,
  segmentCount: 5,
  spriteStem: "cinder_wyrm",
  lore: {
    epithet: "Furnace of the Broken Stars",
    origin:
      "Hatched in the slag fields left when the Vaelith detonated eleven stars to seal the lanes.",
    description:
      "Ten thousand years of slag-fed growth turned a vacuum-grazing serpent into a hunter the length of a cruiser. It nests in the Reach's cooling debris and treats the lane traffic of the five factions as prey.",
    tactics:
      "Wait for the fan-shaped wind-up and leave the cone; shoot the glowing ember gland on its tail, not its armoured flanks. Burn the throat and it cannot spray.",
  },
};
