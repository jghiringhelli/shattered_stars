/**
 * TacticalOrders — the continuous-tactical dial on the tabletop cycle engine.
 *
 * The player commands a squad by dialing a standing maneuver order per ship
 * (direction + speed from that ship's dial). The order latches into the
 * engine's queue (`nextManeuver` + `speed`) and flies at the next cycle
 * boundary; because the engine clears the queue on commit, the scene
 * re-latches the standing order every frame until the player dials another.
 *
 * Pure: no Phaser.
 */

import { samplePath, type ShipControlState } from "../../core/ArcadeControls";
import type { ManeuverDefinition, ManeuverDirection } from "../../core/types";
import { generateManeuverPath } from "../../systems/MovementSystem";

/** Waypoints sampled per previewed maneuver (matches the engine's path). */
export const PREVIEW_PATH_POINTS = 20;

/** A pose on the battlefield. */
export interface PreviewPose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** What the ship will fly: the rest of this cycle, then the queued order. */
export interface OrderPreview {
  /** From the ship's pose to the end of the maneuver in flight. */
  readonly remaining: readonly PreviewPose[];
  /** The ordered maneuver, flown from the end of the current cycle. */
  readonly queued: readonly PreviewPose[];
}

/**
 * The dial entry in a direction whose speed is closest to the wanted one.
 *
 * @param dial - The ship's dial.
 * @param direction - Wanted direction.
 * @param speed - Wanted speed.
 * @param accept - Optional filter (e.g. reject red maneuvers).
 * @returns The closest entry, or undefined when none qualifies.
 */
export function nearestDialManeuver(
  dial: readonly ManeuverDefinition[],
  direction: ManeuverDirection,
  speed: number,
  accept: (maneuver: ManeuverDefinition) => boolean = () => true,
): ManeuverDefinition | undefined {
  let best: ManeuverDefinition | undefined;
  for (const maneuver of dial) {
    if (maneuver.direction !== direction || !accept(maneuver)) continue;
    const gap = Math.abs(maneuver.speed - speed);
    if (!best || gap < Math.abs(best.speed - speed)) best = maneuver;
  }
  return best;
}

/**
 * A freshly spawned ship's standing order: fly straight near cruise speed.
 *
 * @param dial - The ship's dial.
 * @param cruiseSpeed - The engine's spawn speed for the ship.
 * @returns The dial's straight nearest cruise speed (or a synthetic one).
 */
export function initialOrder(
  dial: readonly ManeuverDefinition[],
  cruiseSpeed: number,
): ManeuverDefinition {
  return (
    nearestDialManeuver(dial, "straight", cruiseSpeed) ?? {
      direction: "straight",
      speed: cruiseSpeed,
      difficulty: "white",
    }
  );
}

/**
 * A stressed pilot may not fly red: a red order is slowed to the same
 * direction's nearest non-red speed, else straightened out.
 *
 * @param order - The standing order.
 * @param dial - The ship's dial.
 * @param isStressed - Whether the pilot is stressed.
 * @returns The order the pilot may actually fly.
 */
export function calmOrderIfStressed(
  order: ManeuverDefinition,
  dial: readonly ManeuverDefinition[],
  isStressed: boolean,
): ManeuverDefinition {
  if (!isStressed || order.difficulty !== "red") return order;
  const notRed = (m: ManeuverDefinition): boolean => m.difficulty !== "red";
  return (
    nearestDialManeuver(dial, order.direction, order.speed, notRed) ??
    nearestDialManeuver(dial, "straight", order.speed, notRed) ??
    order
  );
}

/**
 * Queue a standing order on the cycle engine: it flies at the next cycle
 * boundary, the maneuver in flight is untouched.
 *
 * @param control - The ship's control state.
 * @param order - The standing order.
 * @returns Control with the order queued (the same object if already queued).
 */
export function latchManeuverOrder(
  control: ShipControlState,
  order: ManeuverDefinition,
): ShipControlState {
  const nextManeuver = order.direction === "straight" ? null : order.direction;
  const speed = clampOrderSpeed(control, order.speed);
  if (control.nextManeuver === nextManeuver && control.speed === speed) {
    return control;
  }
  return { ...control, nextManeuver, speed };
}

/**
 * Where the ship will fly: the rest of the cycle in flight, then the ordered
 * maneuver from that cycle's end — the same template geometry, base size and
 * movement profile the engine flies.
 *
 * @param pose - The ship's current (wrapped) pose.
 * @param control - The ship's control state.
 * @param order - The standing order.
 * @returns Both legs as pose lists.
 */
export function planOrderPreview(
  pose: PreviewPose,
  control: ShipControlState,
  order: ManeuverDefinition,
): OrderPreview {
  const remaining = remainingCyclePath(pose, control);
  const start = remaining[remaining.length - 1] ?? pose;
  const queued = generateManeuverPath(
    start.x,
    start.y,
    start.angle,
    { ...order, speed: clampOrderSpeed(control, order.speed) },
    PREVIEW_PATH_POINTS,
    control.baseSize,
    control.movementProfile,
  );
  return { remaining, queued };
}

/**
 * Ordered speed limited to what the ship can fly.
 * @param control - The ship's speed bounds.
 * @param speed - Ordered speed.
 * @returns The clamped speed.
 */
function clampOrderSpeed(
  control: Pick<ShipControlState, "minSpeed" | "maxSpeed">,
  speed: number,
): number {
  return Math.min(control.maxSpeed, Math.max(control.minSpeed, speed));
}

/**
 * The rest of the maneuver in flight, from the ship's pose to the cycle end.
 * The engine keeps the path unwrapped while the pose wraps at the world
 * edge, so the path is shifted onto the pose.
 *
 * @param pose - The ship's current (wrapped) pose.
 * @param control - The ship's control state.
 * @returns Poses from the ship to the end of the cycle.
 */
function remainingCyclePath(
  pose: PreviewPose,
  control: ShipControlState,
): PreviewPose[] {
  const path = control.maneuverPath;
  const onPath = samplePath(path, control.maneuverProgress);
  if (!onPath || path.length < 2) return [pose];
  const dx = pose.x - onPath.x;
  const dy = pose.y - onPath.y;
  const lastIndex = path.length - 1;
  const ahead = path
    .filter((_, i) => i / lastIndex > control.maneuverProgress)
    .map((p) => ({ x: p.x + dx, y: p.y + dy, angle: p.angle }));
  return [{ x: pose.x, y: pose.y, angle: pose.angle }, ...ahead];
}
