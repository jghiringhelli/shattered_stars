/**
 * Deterministic demo data for HudPreviewScene — a function of elapsed time
 * only, so a frozen time gives a reproducible screenshot.
 *
 * The player drifts east across the torus seam (x = BATTLEFIELD_SIZE → 0)
 * while contacts orbit at chosen bearings/radii so that, at zoom 1, there are
 * on-screen ships, off-screen ships on all four edges and both diagonals,
 * ships beyond radar range (clamped/dimmed), one beyond the edge-arrow max
 * distance (hidden), a locked target, and a dead contact (skipped).
 */

import { BATTLEFIELD_SIZE } from "../../config";
import { STRESS_HIGH } from "../../arcade/ArcadeStress";
import { wrapCoordinate } from "../../arcade/systems/ShipMotion";
import type { HoloSide } from "../../ui/theme/HoloTheme";
import type {
  ContactHudState,
  HudPose,
  HudSizeClass,
  PlayerHudState,
  WeaponSlotDescriptor,
} from "../../ui/hud/types";

const DEG_TO_RAD = Math.PI / 180;
const MS_PER_SECOND = 1000;
const PLAYER_START = {
  x: BATTLEFIELD_SIZE - 200,
  y: BATTLEFIELD_SIZE / 2,
} as const;
const PLAYER_DRIFT_PX_PER_MS = 0.04;
const PLAYER_SWAY = { baseDeg: 90, amplitudeDeg: 20, periodMs: 3000 } as const;
const STRESS_WAVE_PERIOD_MS = 2200;
const PLAYER_STATS = {
  hull: 6,
  maxHull: 8,
  shields: 2.5,
  maxShields: 3,
  speed: 3,
  maxSpeed: 5,
  maneuver: "Bank R 3",
} as const;
const COOLDOWN_PERIOD_MS = { missile: 3000, turret: 800 } as const;
const MINE_COOLDOWN = 0.35;
/** Degrees between a tangent heading and its orbit bearing. */
const QUARTER_TURN_DEG = 90;

/** Optional player overrides set by the preview / e2e. */
export interface PreviewPlayerOverrides {
  readonly stress?: number | undefined;
  readonly isStressed?: boolean | undefined;
  readonly hull?: number | undefined;
  readonly shields?: number | undefined;
}

interface OrbitSpec {
  readonly id: string;
  readonly side: HoloSide;
  readonly sizeClass: HudSizeClass;
  readonly radius: number;
  readonly bearingDeg: number;
  readonly degPerSecond: number;
  readonly isTarget?: boolean;
  readonly alive?: boolean;
}

const ORBITS: ReadonlyArray<OrbitSpec> = [
  {
    id: "wing-1",
    side: "ally",
    sizeClass: "small",
    radius: 220,
    bearingDeg: 200,
    degPerSecond: 6,
  },
  {
    id: "wing-2",
    side: "ally",
    sizeClass: "medium",
    radius: 380,
    bearingDeg: 150,
    degPerSecond: -4,
  },
  {
    id: "bandit-near",
    side: "enemy",
    sizeClass: "small",
    radius: 300,
    bearingDeg: 320,
    degPerSecond: 8,
  },
  {
    id: "ace",
    side: "enemy",
    sizeClass: "small",
    radius: 950,
    bearingDeg: 10,
    degPerSecond: 3,
    isTarget: true,
  },
  {
    id: "bandit-left",
    side: "enemy",
    sizeClass: "medium",
    radius: 1150,
    bearingDeg: 182,
    degPerSecond: -2,
  },
  {
    id: "bandit-top",
    side: "enemy",
    sizeClass: "tiny",
    radius: 650,
    bearingDeg: 268,
    degPerSecond: 2,
  },
  {
    id: "bomber-bottom",
    side: "enemy",
    sizeClass: "large",
    radius: 560,
    bearingDeg: 95,
    degPerSecond: 2,
  },
  {
    id: "bandit-low-left",
    side: "enemy",
    sizeClass: "small",
    radius: 1000,
    bearingDeg: 140,
    degPerSecond: 1,
  },
  {
    id: "corner-raider",
    side: "enemy",
    sizeClass: "small",
    radius: 1500,
    bearingDeg: 35,
    degPerSecond: 1.5,
  },
  {
    id: "freighter",
    side: "neutral",
    sizeClass: "huge",
    radius: 1500,
    bearingDeg: 230,
    degPerSecond: -1,
  },
  {
    id: "distant-ally",
    side: "ally",
    sizeClass: "large",
    radius: 2500,
    bearingDeg: 300,
    degPerSecond: 1,
  },
  {
    id: "deep-contact",
    side: "enemy",
    sizeClass: "medium",
    radius: 4000,
    bearingDeg: 120,
    degPerSecond: 0.5,
  },
  {
    id: "wreck",
    side: "enemy",
    sizeClass: "small",
    radius: 500,
    bearingDeg: 60,
    degPerSecond: 0,
    alive: false,
  },
];

/**
 * Player pose at a time.
 *
 * @param timeMs - Elapsed preview time.
 * @returns Wrapped world pose.
 */
export function previewPlayerPose(timeMs: number): HudPose {
  return {
    x: wrapCoordinate(
      PLAYER_START.x + timeMs * PLAYER_DRIFT_PX_PER_MS,
      BATTLEFIELD_SIZE,
    ),
    y: PLAYER_START.y,
    angle:
      PLAYER_SWAY.baseDeg +
      PLAYER_SWAY.amplitudeDeg *
        Math.sin((timeMs / PLAYER_SWAY.periodMs) * Math.PI * 2),
  };
}

/**
 * Player HUD state at a time, with optional overrides.
 *
 * @param timeMs - Elapsed preview time.
 * @param overrides - Fixed stress/hull/shield values.
 * @returns Player state.
 */
export function previewPlayer(
  timeMs: number,
  overrides: PreviewPlayerOverrides,
): PlayerHudState {
  const wave =
    (Math.sin((timeMs / STRESS_WAVE_PERIOD_MS) * Math.PI * 2) + 1) / 2;
  const stress = overrides.stress ?? wave;
  return {
    pose: previewPlayerPose(timeMs),
    hull: overrides.hull ?? PLAYER_STATS.hull,
    maxHull: PLAYER_STATS.maxHull,
    shields: overrides.shields ?? PLAYER_STATS.shields,
    maxShields: PLAYER_STATS.maxShields,
    stress,
    isStressed: overrides.isStressed ?? stress >= STRESS_HIGH,
    speed: PLAYER_STATS.speed,
    maxSpeed: PLAYER_STATS.maxSpeed,
    maneuver: PLAYER_STATS.maneuver,
  };
}

/**
 * Contacts orbiting the player at a time.
 *
 * @param timeMs - Elapsed preview time.
 * @param player - Player pose (orbit centre).
 * @returns Contact states with wrapped world positions.
 */
export function previewContacts(
  timeMs: number,
  player: HudPose,
): ContactHudState[] {
  return ORBITS.map((orbit) => {
    const bearingDeg =
      orbit.bearingDeg + (orbit.degPerSecond * timeMs) / MS_PER_SECOND;
    const bearing = bearingDeg * DEG_TO_RAD;
    const tangent =
      orbit.degPerSecond >= 0 ? QUARTER_TURN_DEG : -QUARTER_TURN_DEG;
    return {
      id: orbit.id,
      pose: {
        x: wrapCoordinate(
          player.x + Math.cos(bearing) * orbit.radius,
          BATTLEFIELD_SIZE,
        ),
        y: wrapCoordinate(
          player.y + Math.sin(bearing) * orbit.radius,
          BATTLEFIELD_SIZE,
        ),
        angle: bearingDeg + QUARTER_TURN_DEG + tangent,
      },
      side: orbit.side,
      sizeClass: orbit.sizeClass,
      isTarget: orbit.isTarget === true,
      alive: orbit.alive !== false,
    };
  });
}

function sawtooth(timeMs: number, periodMs: number): number {
  return 1 - (timeMs % periodMs) / periodMs;
}

/**
 * Weapon slots at a time (missile/turret cooldowns cycle).
 *
 * @param timeMs - Elapsed preview time.
 * @returns Slot descriptors, left to right.
 */
export function previewWeapons(timeMs: number): WeaponSlotDescriptor[] {
  return [
    {
      id: "laser",
      kind: "primary",
      cooldown: 0,
      selected: false,
      keyHint: "1",
    },
    {
      id: "missiles",
      kind: "missile",
      charges: 3,
      maxCharges: 4,
      cooldown: sawtooth(timeMs, COOLDOWN_PERIOD_MS.missile),
      selected: true,
      keyHint: "2",
    },
    {
      id: "torpedo",
      kind: "torpedo",
      charges: 1,
      maxCharges: 2,
      cooldown: 0,
      selected: false,
      keyHint: "3",
    },
    {
      id: "turret",
      kind: "turret",
      cooldown: sawtooth(timeMs, COOLDOWN_PERIOD_MS.turret),
      selected: false,
      keyHint: "4",
    },
    {
      id: "bombs",
      kind: "bomb",
      charges: 0,
      maxCharges: 2,
      cooldown: 0,
      selected: false,
      keyHint: "5",
    },
    {
      id: "mines",
      kind: "mine",
      charges: 7,
      maxCharges: 10,
      cooldown: MINE_COOLDOWN,
      selected: false,
      keyHint: "6",
    },
  ];
}
