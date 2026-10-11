/**
 * Per-ship hull/shield overlay and repair feedback — public API.
 * The overlay view itself is src/ui/HealthBar.ts.
 */

export {
  ShipRepairFeedback,
  type AuraRepairRates,
  type RepairFeedbackDebugState,
  type RepairFeedbackShip,
  type RepairOverlay,
  type ShipRepairFeedbackOptions,
} from "./ShipRepairFeedback";
export { type OverlayRepairNote, type ShipOverlayState } from "./overlayState";
export {
  OVERLAY_GEOMETRY,
  overlaySide,
  overlayVisible,
  segmentFill,
  shieldSegmentCount,
} from "./overlayLayout";
