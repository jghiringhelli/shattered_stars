/**
 * Deepmaw — Survival sector 2 boss. A lane-dwelling leviathan from the
 * Deep's shallows, drawn up into the Reach when the lanes collapsed. It
 * barely swims: it drifts on a standoff orbit and lets its tentacles and
 * maw do the work — a sweeping arc, a tractor channel that drags ships to
 * its mouth, a spore bloom that slows whoever lingers. It heals only by
 * eating wrecks, and a hit breaks the meal.
 */

import type { CreatureDefinition } from "./creatureTypes";

export const DEEPMAW: CreatureDefinition = {
  id: "deepmaw",
  name: "Deepmaw",
  sizeClass: "huge",
  radiusPx: 120,
  hullPoints: 105,
  shieldPoints: 24,
  movement: {
    style: "drift",
    speedPxPerS: 60,
    turnDegPerS: 22,
    standoffPx: 360,
    amplitude: 0,
    periodMs: 6000,
  },
  powers: [
    {
      id: "tentacle_sweep",
      name: "TENTACLE SWEEP",
      kind: "sweep",
      targeting: "nearest",
      windupCycles: 1,
      cooldownCycles: 5,
      damage: 10,
      stress: 0.1,
      rangePx: 330,
      arcDeg: 70,
      durationMs: 1000,
      requiresPart: "tentacles_port",
      fromPhase: 0,
      weight: 3,
    },
    {
      id: "maw_tractor",
      name: "MAW TRACTOR",
      kind: "pull",
      targeting: "farthest",
      windupCycles: 2,
      cooldownCycles: 10,
      damage: 9,
      stress: 0.15,
      rangePx: 560,
      durationMs: 1500,
      pullSpeedPxPerS: 230,
      triggerRangePx: 640,
      requiresPart: "tentacles_starboard",
      fromPhase: 0,
      weight: 2,
    },
    {
      id: "spore_bloom",
      name: "SPORE BLOOM",
      kind: "cloud",
      targeting: "cluster",
      windupCycles: 2,
      cooldownCycles: 11,
      damage: 1,
      stress: 0.12,
      rangePx: 210,
      durationMs: 5000,
      slowFactor: 0.55,
      triggerRangePx: 700,
      requiresPart: "gut_sac",
      fromPhase: 0,
      weight: 2,
    },
  ],
  parts: [
    {
      id: "tentacles_port",
      name: "Port tentacles",
      hpPoints: 4,
      bearingDeg: -90,
      arcDeg: 80,
      damageMultiplier: 1.4,
      offsetPx: 110,
    },
    {
      id: "tentacles_starboard",
      name: "Starboard tentacles",
      hpPoints: 4,
      bearingDeg: 90,
      arcDeg: 80,
      damageMultiplier: 1.4,
      offsetPx: 110,
    },
    {
      id: "gut_sac",
      name: "Gut sac",
      hpPoints: 3,
      bearingDeg: 180,
      arcDeg: 90,
      damageMultiplier: 1.6,
      offsetPx: 100,
    },
    {
      id: "cilia_ring",
      name: "Cilia ring",
      hpPoints: 6,
      bearingDeg: 0,
      arcDeg: 50,
      damageMultiplier: 0.5,
      offsetPx: 90,
    },
  ],
  phases: [
    { name: "DRIFTING", speedScale: 1, cooldownScale: 1, damageScale: 1 },
    { name: "STARVING", speedScale: 1.5, cooldownScale: 0.7, damageScale: 1.2 },
    {
      name: "RAVENOUS",
      speedScale: 1.7,
      cooldownScale: 0.55,
      damageScale: 1.3,
    },
  ],
  feedHullPoints: 3,
  isBoss: true,
  segmentCount: 0,
  spriteStem: "deepmaw",
  lore: {
    epithet: "Mouth Under the Lanes",
    origin:
      "A Deep-shallows grazer that followed the collapsing lanes into the Shattered Reach.",
    description:
      "Lane crews call them mouths because that is all anyone sees before the tractor takes hold. The Deepmaw does not hunt so much as drift where the Deep's whisper is thickest — and psions, as everyone knows, are loud.",
    tactics:
      "Break line of sight to the ring-shaped maw when the inward-arrow wind-up appears, then strip a tentacle cluster to switch off its sweep or its tractor. Never fly into the spore bloom; kill the gut sac from astern. If it heads for a wreck, hit it — a hit breaks the meal.",
  },
};
