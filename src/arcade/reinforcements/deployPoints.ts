/**
 * deployPoints — where reinforcements warp in: each side has a deploy edge
 * {@link DEPLOY_EDGE_OFFSET_PX} from the battlefield centre (the player's
 * below it, the opponent's above; more sides spread evenly around it), every
 * ship facing the centre. Successive deployments fan out along the edge so
 * arrivals do not stack.
 *
 * Pure. Angles in degrees, 0 = up, clockwise (the scene's convention).
 */

/** Distance of a deploy edge from the centre (px): a few seconds' flight. */
export const DEPLOY_EDGE_OFFSET_PX = 1600;

/** Spacing of arrivals along an edge (px). */
export const DEPLOY_SPACING_PX = 220;

/** Arrival slots along an edge before they repeat. */
export const DEPLOY_SLOTS = 5;

/** Screen-polar angle of the player's edge (straight below the centre). */
const PLAYER_EDGE_DEG = 90;
/** Heading = polar angle + this (points from the edge back to the centre). */
const FACE_CENTRE_DEG = 270;
const FULL_TURN_DEG = 360;
const RAD_PER_DEG = Math.PI / 180;

/** A position and heading. */
export interface DeployPose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/**
 * @param sideIndex - 0 = the player's side, then each opposing faction.
 * @param sideCount - Number of sides.
 * @param worldSize - Torus side length.
 * @returns The centre of the side's deploy edge, facing the battlefield centre.
 */
export function sideHome(
  sideIndex: number,
  sideCount: number,
  worldSize: number,
): DeployPose {
  const polar =
    PLAYER_EDGE_DEG + (sideIndex * FULL_TURN_DEG) / Math.max(1, sideCount);
  const centre = worldSize / 2;
  return {
    x: centre + Math.cos(polar * RAD_PER_DEG) * DEPLOY_EDGE_OFFSET_PX,
    y: centre + Math.sin(polar * RAD_PER_DEG) * DEPLOY_EDGE_OFFSET_PX,
    angle: (polar + FACE_CENTRE_DEG) % FULL_TURN_DEG,
  };
}

/**
 * @param home - A deploy edge's centre.
 * @param slot - The arrival's number on that edge.
 * @returns Its pose: centre first, then alternately to either side.
 */
export function deployPose(home: DeployPose, slot: number): DeployPose {
  const index = ((slot % DEPLOY_SLOTS) + DEPLOY_SLOTS) % DEPLOY_SLOTS;
  const step = Math.ceil(index / 2) * (index % 2 === 1 ? 1 : -1);
  const lateral = home.angle * RAD_PER_DEG;
  return {
    x: home.x + Math.cos(lateral) * step * DEPLOY_SPACING_PX,
    y: home.y + Math.sin(lateral) * step * DEPLOY_SPACING_PX,
    angle: home.angle,
  };
}
