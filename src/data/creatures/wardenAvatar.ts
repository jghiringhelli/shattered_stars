/**
 * Warden Avatar — the Void Tide's own face: the Warden, a gardener the
 * Lanewrights built to keep the lane network healthy, answering the loud
 * chorus of the Reach. Final Campaign boss (Act V: "Heart of the Void" /
 * "The Answer"). A huge bloom of black petals that drifts through the fight;
 * each petal runs a power, so cutting petals disarms the Warden. In its
 * last phase it stops drifting and phase-shifts like its heralds.
 */

import type { CreatureDefinition, CreaturePartSpec } from "./creatureTypes";

const petal = (
  id: string,
  name: string,
  bearingDeg: number,
): CreaturePartSpec => ({
  id,
  name,
  hpPoints: 4,
  bearingDeg,
  arcDeg: 70,
  damageMultiplier: 1.3,
  offsetPx: 150,
});

export const WARDEN_AVATAR: CreatureDefinition = {
  id: "warden_avatar",
  name: "Warden Avatar",
  sizeClass: "huge",
  radiusPx: 150,
  hullPoints: 34,
  shieldPoints: 14,
  movement: {
    style: "drift",
    speedPxPerS: 70,
    turnDegPerS: 30,
    standoffPx: 420,
    amplitude: 0,
    periodMs: 7000,
  },
  powers: [
    {
      id: "silence_ring",
      name: "SILENCE RING",
      kind: "ring",
      targeting: "nearest",
      windupCycles: 2,
      cooldownCycles: 5,
      damage: 14,
      stress: 0.3,
      rangePx: 520,
      innerRangePx: 190,
      requiresPart: "petal_dawn",
      fromPhase: 0,
      weight: 3,
    },
    {
      id: "root_sweep",
      name: "ROOT SWEEP",
      kind: "sweep",
      targeting: "nearest",
      windupCycles: 1,
      cooldownCycles: 3,
      damage: 11,
      stress: 0.1,
      rangePx: 460,
      arcDeg: 80,
      durationMs: 1100,
      requiresPart: "petal_dusk",
      fromPhase: 0,
      weight: 3,
    },
    {
      id: "lane_pull",
      name: "LANE PULL",
      kind: "pull",
      targeting: "farthest",
      windupCycles: 2,
      cooldownCycles: 8,
      damage: 10,
      stress: 0.2,
      rangePx: 700,
      durationMs: 1600,
      pullSpeedPxPerS: 240,
      triggerRangePx: 780,
      requiresPart: "petal_noon",
      fromPhase: 1,
      weight: 2,
    },
    {
      id: "tide_call",
      name: "TIDE CALL",
      kind: "summon",
      targeting: "nearest",
      windupCycles: 2,
      cooldownCycles: 9,
      damage: 0,
      stress: 0,
      rangePx: 0,
      spawnCount: 2,
      spawnCreatureId: "tidecell",
      fromPhase: 1,
      weight: 2,
    },
    {
      id: "the_hush",
      name: "THE HUSH",
      kind: "scream",
      targeting: "flagship",
      windupCycles: 2,
      cooldownCycles: 7,
      damage: 5,
      stress: 0.55,
      rangePx: 800,
      requiresPart: "petal_midnight",
      fromPhase: 1,
      weight: 2,
    },
    {
      id: "pruning_ray",
      name: "PRUNING RAY",
      kind: "cone",
      targeting: "flagship",
      windupCycles: 1,
      cooldownCycles: 4,
      damage: 13,
      stress: 0.15,
      rangePx: 640,
      arcDeg: 36,
      fromPhase: 2,
      weight: 3,
    },
  ],
  parts: [
    petal("petal_dawn", "Dawn petal", 0),
    petal("petal_noon", "Noon petal", 90),
    petal("petal_dusk", "Dusk petal", 180),
    petal("petal_midnight", "Midnight petal", -90),
  ],
  phases: [
    { name: "TENDING", speedScale: 1, cooldownScale: 1, damageScale: 1 },
    { name: "PRUNING", speedScale: 1.2, cooldownScale: 0.8, damageScale: 1.15 },
    {
      name: "THE ANSWER",
      speedScale: 1.5,
      cooldownScale: 0.6,
      damageScale: 1.3,
      movementStyle: "blink",
    },
  ],
  feedHullPoints: 0,
  isBoss: true,
  segmentCount: 0,
  spriteStem: "warden_avatar",
  lore: {
    epithet: "The Gardener Wakes",
    origin:
      "Seeded in the Deep by the Lanewrights ~40,000 years ago to keep the lanes healthy; woken by the Nexus Broadcast and the Breach.",
    description:
      "The Warden is not cruel. It is a gardener, and the Reach has grown loud: psionic choirs, starbreaking, a lock cracked open by the Nexus. The Avatar is what it sends to the weeds it cannot reach any other way. It has been answering the same question for ten thousand years.",
    tactics:
      "Every petal runs a power — cut dawn for the ring, dusk for the sweep, noon for the lane pull, midnight for the Hush. In its last phase it phase-shifts: hold formation, mark it when it lands and strike its petals from behind.",
  },
};
