/**
 * Pruning Herald — a Void Tide gardener construct and Warden-side boss for
 * the Campaign's Act III–IV finales (the Tide's front arriving). The Warden
 * keeps the lanes "healthy" by pruning loud minds; the Herald is the shear.
 * It stalks at standoff and phase-shifts: untargetable while it relocates,
 * reappearing on the far side of its prey with a blade fan. Its lens-eye is
 * its weak point (and its phase-shift engine); its shear blades are armour.
 */

import type { CreatureDefinition } from "./creatureTypes";

export const PRUNING_HERALD: CreatureDefinition = {
  id: "pruning_herald",
  name: "Pruning Herald",
  sizeClass: "large",
  radiusPx: 64,
  hullPoints: 16,
  shieldPoints: 9,
  movement: {
    style: "blink",
    speedPxPerS: 120,
    turnDegPerS: 140,
    standoffPx: 340,
    amplitude: 0,
    periodMs: 4000,
  },
  powers: [
    {
      id: "shear_fan",
      name: "SHEAR FAN",
      kind: "cone",
      targeting: "nearest",
      windupCycles: 1,
      cooldownCycles: 3,
      damage: 10,
      stress: 0.1,
      rangePx: 320,
      arcDeg: 90,
      requiresPart: "shear_blades",
      fromPhase: 0,
      weight: 3,
    },
    {
      id: "phase_prune",
      name: "PHASE-SHIFT",
      kind: "blink",
      targeting: "flagship",
      windupCycles: 1,
      cooldownCycles: 4,
      damage: 0,
      stress: 0,
      rangePx: 300,
      triggerRangePx: 900,
      requiresPart: "lens_eye",
      fromPhase: 0,
      weight: 3,
    },
    {
      id: "mind_prune",
      name: "MIND PRUNE",
      kind: "scream",
      targeting: "flagship",
      windupCycles: 2,
      cooldownCycles: 8,
      damage: 3,
      stress: 0.5,
      rangePx: 650,
      fromPhase: 1,
      weight: 2,
    },
  ],
  parts: [
    {
      id: "lens_eye",
      name: "Lens-eye",
      hpPoints: 3,
      bearingDeg: 0,
      arcDeg: 36,
      damageMultiplier: 1.6,
      offsetPx: 52,
    },
    {
      id: "shear_blades",
      name: "Shear blades",
      hpPoints: 5,
      bearingDeg: 90,
      arcDeg: 70,
      damageMultiplier: 0.7,
      offsetPx: 60,
    },
    {
      id: "shear_blades_port",
      name: "Shear blades",
      hpPoints: 5,
      bearingDeg: -90,
      arcDeg: 70,
      damageMultiplier: 0.7,
      offsetPx: 60,
    },
  ],
  phases: [
    { name: "PRUNING", speedScale: 1, cooldownScale: 1, damageScale: 1 },
    { name: "HARVEST", speedScale: 1.25, cooldownScale: 0.7, damageScale: 1.2 },
  ],
  feedHullPoints: 0,
  isBoss: true,
  segmentCount: 0,
  spriteStem: "pruning_herald",
  lore: {
    epithet: "Shears of the Warden",
    origin:
      "Grown by the Warden along the consumed lanes, the first thing the Void Tide sends to a system that has grown loud.",
    description:
      "Where the Tide's tidecells hunt single minds, the Herald prunes whole choirs. It does not fly the lanes — it slips between them, and a Herald that has your pilot's signature will arrive on the far side of the wing before the alarm sounds.",
    tactics:
      "It is untargetable while phase-shifting: do not waste shots, fly to where the destination mark is and wait. Destroy the lens-eye to take the phase-shift away; blades are armoured. Stay spread when MIND PRUNE winds up — the stress hits everyone in earshot.",
  },
};
