/**
 * Speed-based camera zoom target, from the speed the ship actually FLIES
 * (a cycle may fly slower or faster than the throttle that was set).
 */

/** The speed fields of a ship's flight control. */
export interface FlownSpeedControl {
  /** The throttle the pilot set. */
  readonly speed: number;
  /** The speed the current cycle is flown at, when known. */
  readonly cycleSpeed?: number;
}

/** Zoom range mapped onto the speed notches. */
export interface SpeedZoomRange {
  /** Zoom at the slowest notch (1). */
  readonly slowest: number;
  /** Zoom at the fastest notch. */
  readonly fastest: number;
  /** The fastest notch. Default 5. */
  readonly maxSpeed?: number;
}

const DEFAULT_MAX_SPEED = 5;

/**
 * @param control - A ship's flight control.
 * @returns The speed it flies at: the cycle's, else the set throttle.
 */
export function flownSpeed(control: FlownSpeedControl): number {
  return control.cycleSpeed ?? control.speed;
}

/**
 * @param control - A ship's flight control.
 * @param range - Zoom at the slowest and fastest notch.
 * @returns The zoom to ease toward (zooms out as the flown speed rises).
 */
export function speedZoomTarget(
  control: FlownSpeedControl,
  range: SpeedZoomRange,
): number {
  const maxSpeed = range.maxSpeed ?? DEFAULT_MAX_SPEED;
  const ratio = Math.min(
    1,
    Math.max(0, (flownSpeed(control) - 1) / (maxSpeed - 1)),
  );
  return range.slowest + (range.fastest - range.slowest) * ratio;
}
