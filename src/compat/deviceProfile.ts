/**
 * Device classification (pure): is this a desktop with a mouse/keyboard, or a
 * phone/tablet the beta does not target? Used to show a one-time notice and a
 * portrait hint; it never gates the game.
 */

/** Raw facts read from the window (see probeEnvironment.readDeviceSignals). */
export interface DeviceSignals {
  readonly maxTouchPoints: number;
  /** `(pointer: coarse)` — the PRIMARY pointer is imprecise (finger). */
  readonly coarsePointer: boolean;
  /** `(any-pointer: fine)` — some attached pointer is precise (mouse, trackpad, pen). */
  readonly anyFinePointer: boolean;
  /** `(hover: hover)` — the primary pointer can hover. */
  readonly canHover: boolean;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

/** desktop — nothing to say; touch-only — no mouse/keyboard-class pointer; small-screen — viewport too small for the 16:9 UI. */
export type DeviceClass = "desktop" | "touch-only" | "small-screen";

/** Viewports whose shorter side is below this are too small for the HUD to be legible. */
export const SMALL_VIEWPORT_MIN_SIDE_PX = 480;

/**
 * @param signals - Pointer capabilities and viewport size.
 * @returns The device class. A touch laptop or a tablet with a mouse stays
 *   `desktop` because a fine pointer is attached.
 */
export function classifyDevice(signals: DeviceSignals): DeviceClass {
  const hasTouch = signals.maxTouchPoints > 0;
  if (hasTouch && signals.coarsePointer && !signals.anyFinePointer && !signals.canHover) {
    return "touch-only";
  }
  const shortSide = Math.min(signals.viewportWidth, signals.viewportHeight);
  if (shortSide < SMALL_VIEWPORT_MIN_SIDE_PX) return "small-screen";
  return "desktop";
}

/**
 * @param width - Viewport width.
 * @param height - Viewport height.
 * @returns True when the viewport is strictly taller than wide.
 */
export function isPortrait(width: number, height: number): boolean {
  return height > width;
}

/**
 * @param deviceClass - Result of {@link classifyDevice}.
 * @param dismissed - The player already dismissed the notice.
 * @returns True when the one-time device notice should appear.
 */
export function shouldShowDeviceNotice(
  deviceClass: DeviceClass,
  dismissed: boolean,
): boolean {
  return deviceClass !== "desktop" && !dismissed;
}
