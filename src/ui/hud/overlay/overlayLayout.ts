/**
 * overlayLayout — pure geometry and reading rules for the per-ship
 * hull/shield overlay (src/ui/HealthBar.ts draws it).
 *
 * Shields read as discrete segments, one per miniature shield token (the
 * Tabletop shield tokens: maxShields / DURABILITY_SCALE), capped so capital
 * ships stay readable. Hull reads as a continuous bar with a tick per
 * miniature hull point. No Phaser.
 */

import { DURABILITY_SCALE, type ShipSize } from "../../../config";
import type { HoloSide } from "../../theme/HoloTheme";

/** Most shield segments drawn; bigger pools share a segment between tokens. */
export const MAX_SHIELD_SEGMENTS = 10;

/** Most hull ticks drawn; beyond this the ticks would blur into a hatch. */
export const MAX_HULL_TICKS = 16;

/** Hull fraction above which the hull reads healthy. */
export const HULL_HEALTHY_FRACTION = 0.6;

/** Hull fraction at or below which the hull reads critical. */
export const HULL_CRITICAL_FRACTION = 0.3;

/** Tolerance when counting whole segments (float noise from regen). */
const SEGMENT_EPSILON = 1e-9;

/** Lit shield segments plus the charge of the next one. */
export interface SegmentFill {
  /** Fully lit segments. */
  readonly lit: number;
  /** Charge of the next segment, 0 ≤ partial < 1. */
  readonly partial: number;
}

/** Hull condition band (paired with width, never shown by colour alone). */
export type HullState = "healthy" | "damaged" | "critical";

/** Overlay dimensions for one ship size, in world pixels. */
export interface OverlayGeometry {
  /** Total bar width. */
  readonly width: number;
  /** Height of a shield segment. */
  readonly segmentHeight: number;
  /** Gap between shield segments. */
  readonly segmentGap: number;
  /** Height of the hull bar. */
  readonly hullHeight: number;
  /** Gap between the shield row and the hull bar. */
  readonly rowGap: number;
  /** Size of the side marker (chevron / diamond / brackets). */
  readonly markerSize: number;
}

/** Overlay geometry per hull size — bigger ships get longer, thicker bars. */
export const OVERLAY_GEOMETRY: Readonly<Record<ShipSize, OverlayGeometry>> = {
  tiny: {
    width: 36,
    segmentHeight: 3,
    segmentGap: 1,
    hullHeight: 4,
    rowGap: 1,
    markerSize: 4,
  },
  small: {
    width: 44,
    segmentHeight: 3,
    segmentGap: 1,
    hullHeight: 4,
    rowGap: 1,
    markerSize: 4,
  },
  medium: {
    width: 54,
    segmentHeight: 4,
    segmentGap: 2,
    hullHeight: 5,
    rowGap: 2,
    markerSize: 5,
  },
  large: {
    width: 68,
    segmentHeight: 4,
    segmentGap: 2,
    hullHeight: 6,
    rowGap: 2,
    markerSize: 6,
  },
  huge: {
    width: 104,
    segmentHeight: 5,
    segmentGap: 2,
    hullHeight: 7,
    rowGap: 2,
    markerSize: 7,
  },
};

/**
 * How many shield segments a ship's overlay draws.
 *
 * @param maxShields - Real-time shield cap.
 * @returns One per miniature token (at least 1 when shielded), capped.
 */
export function shieldSegmentCount(maxShields: number): number {
  if (maxShields <= 0) return 0;
  const tokens = Math.round(maxShields / DURABILITY_SCALE);
  return Math.min(MAX_SHIELD_SEGMENTS, Math.max(1, tokens));
}

/**
 * How many segments are lit for the current shields.
 *
 * @param shields - Current shields.
 * @param maxShields - Shield cap.
 * @param segmentCount - Segments drawn ({@link shieldSegmentCount}).
 * @returns Lit segments and the partial charge of the next one.
 */
export function segmentFill(
  shields: number,
  maxShields: number,
  segmentCount: number,
): SegmentFill {
  if (segmentCount <= 0 || maxShields <= 0) return { lit: 0, partial: 0 };
  const clamped = Math.min(maxShields, Math.max(0, shields));
  const units = (clamped / maxShields) * segmentCount;
  const lit = Math.min(segmentCount, Math.floor(units + SEGMENT_EPSILON));
  const partial = lit >= segmentCount ? 0 : Math.max(0, units - lit);
  return { lit, partial };
}

/**
 * How many miniature hull points the hull bar marks with ticks.
 *
 * @param maxHull - Real-time hull cap.
 * @returns Hull points to mark, or 0 when ticks would not help.
 */
export function hullTickCount(maxHull: number): number {
  const points = Math.round(maxHull / DURABILITY_SCALE);
  return points >= 2 && points <= MAX_HULL_TICKS ? points : 0;
}

/**
 * Hull condition band for a hull fraction.
 *
 * @param fraction - Hull / max hull.
 * @returns healthy, damaged or critical.
 */
export function hullStateOf(fraction: number): HullState {
  if (fraction > HULL_HEALTHY_FRACTION) return "healthy";
  if (fraction > HULL_CRITICAL_FRACTION) return "damaged";
  return "critical";
}

/** One horizontal row of the overlay (relative to the bar centre). */
export interface OverlayRow {
  readonly y: number;
  readonly height: number;
}

/** Vertical layout of the two rows and the bar box. */
export interface OverlayRowLayout {
  /** Shield segment row, or null for an unshielded ship. */
  readonly shieldRow: OverlayRow | null;
  readonly hullRow: OverlayRow;
  readonly left: number;
  readonly width: number;
  readonly top: number;
  readonly height: number;
}

/**
 * Lay out the rows around the bar centre: shields above, hull below.
 *
 * @param geometry - Size-based geometry.
 * @param hasShields - Whether the shield row is drawn.
 * @returns Row positions and the bar box.
 */
export function layoutOverlayRows(
  geometry: OverlayGeometry,
  hasShields: boolean,
): OverlayRowLayout {
  const shieldBlock = hasShields ? geometry.segmentHeight + geometry.rowGap : 0;
  const height = shieldBlock + geometry.hullHeight;
  const top = -height / 2;
  return {
    shieldRow: hasShields ? { y: top, height: geometry.segmentHeight } : null,
    hullRow: { y: top + shieldBlock, height: geometry.hullHeight },
    left: -geometry.width / 2,
    width: geometry.width,
    top,
    height,
  };
}

/**
 * Overlay side of a ship relative to the local player.
 *
 * @param isPlayer - The ship is the one the player flies.
 * @param isFriendly - The ship flies for the player's side.
 * @returns player, ally or enemy.
 */
export function overlaySide(isPlayer: boolean, isFriendly: boolean): HoloSide {
  if (isPlayer) return "player";
  return isFriendly ? "ally" : "enemy";
}

/** What decides whether an overlay is drawn this frame. */
export interface VisibilityInput {
  readonly side: HoloSide;
  /** Hull and shields both full. */
  readonly atFull: boolean;
  /** The ship is the player's marked target. */
  readonly targeted: boolean;
  /** A flash, ghost trail or shimmer is still playing. */
  readonly animating: boolean;
}

/**
 * Visibility rule: your own squad is always shown (you need its state at a
 * glance); a full-health enemy is hidden to declutter until it is targeted,
 * hurt, or something is animating on it.
 *
 * @param input - Side and state.
 * @returns True when the overlay should be drawn.
 */
export function overlayVisible(input: VisibilityInput): boolean {
  if (input.side === "player" || input.side === "ally") return true;
  return !input.atFull || input.targeted || input.animating;
}
