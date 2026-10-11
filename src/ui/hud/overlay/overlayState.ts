/**
 * overlayState — config resolution and the inspectable state contract of
 * the per-ship overlay (src/ui/HealthBar.ts). No Phaser.
 */

import type { ShipSize } from "../../../config";
import { getShipDefinition } from "../../../data/ShipDefinitions";
import type {
  RepairKind,
  RepairSourceKind,
} from "../../../arcade/systems/repair/RepairEvents";
import type { HoloSide } from "../../theme/HoloTheme";
import { OVERLAY_GEOMETRY, type OverlayGeometry } from "./overlayLayout";

/** Size used when neither a size nor a known ship definition is given. */
const DEFAULT_SIZE: ShipSize = "small";

/** Size inputs of an overlay (all optional; ship size is the default). */
export interface OverlaySizing {
  /** Overrides the size-based bar width. */
  readonly width?: number;
  /** Overrides the size-based hull bar height. */
  readonly height?: number;
  /** Hull size class; defaults to the definition's size. */
  readonly size?: ShipSize;
  /** Ship definition id, used to look up the size class. */
  readonly definitionId?: string;
}

/** The last repair shown on an overlay. */
export interface OverlayRepairNote {
  readonly kind: RepairKind;
  readonly sourceKind: RepairSourceKind;
}

/** Inspectable overlay state (e2e specs, debugging). */
export interface ShipOverlayState {
  readonly side: HoloSide;
  readonly visible: boolean;
  readonly targeted: boolean;
  readonly width: number;
  readonly segmentCount: number;
  readonly litSegments: number;
  readonly partialSegment: number;
  readonly hullFraction: number;
  readonly hullTicks: number;
  readonly damageFlash: boolean;
  readonly shieldShimmer: boolean;
  readonly hullShimmer: boolean;
  readonly lastRepair: OverlayRepairNote | null;
  readonly repairCount: number;
}

/**
 * Resolve the overlay geometry from overrides and ship size.
 *
 * @param sizing - Size inputs.
 * @returns Geometry for this ship.
 */
export function overlayGeometryFor(sizing: OverlaySizing): OverlayGeometry {
  const definitionSize = sizing.definitionId
    ? getShipDefinition(sizing.definitionId)?.baseStats.size
    : undefined;
  const base = OVERLAY_GEOMETRY[sizing.size ?? definitionSize ?? DEFAULT_SIZE];
  return {
    ...base,
    width: sizing.width ?? base.width,
    hullHeight: sizing.height ?? base.hullHeight,
  };
}

/**
 * Fraction of a value against its cap (0 when the cap is 0).
 *
 * @param value - Current value.
 * @param max - Cap.
 * @returns value / max, clamped to 0–1.
 */
export function fractionOf(value: number, max: number): number {
  return max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
}
